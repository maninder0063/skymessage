#!/usr/bin/env node
/**
 * Builds a portable Windows SkyMessage app *without* electron-builder.
 *
 * electron-builder needs Windows Developer Mode (or admin) to extract its
 * winCodeSign helper bundle, which contains darwin/*.dylib symlinks. To stay
 * non-elevated, this script bypasses it entirely:
 *
 *   1. Run electron-vite build (already produces out/main, out/preload, out/renderer).
 *   2. Copy the prebuilt Electron runtime from node_modules/electron/dist.
 *   3. Drop our app code into resources/app/ next to electron.exe.
 *   4. Rename electron.exe -> SkyMessage.exe.
 *   5. Zip the folder for distribution.
 *
 * Friends download the zip, extract, double-click SkyMessage.exe. Done.
 *
 * Trade-off vs a real NSIS installer:
 *   - No auto-launch on Windows login (until they sign in once + we set it programmatically).
 *   - No Start Menu shortcut (user pins it themselves).
 *   - Slightly larger download (no asar compression).
 * For a 80-friend demo today, this is the right call. Swap to electron-builder
 * once you've enabled Windows Developer Mode and have a code-signing cert.
 */

import { existsSync, statSync, readdirSync } from 'node:fs';
import { cp, mkdir, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = __dirname;
const repoRoot = resolve(desktopDir, '../..');
const releaseDir = join(desktopDir, 'release');
const portableDir = join(releaseDir, 'SkyMessage-portable');
const appResources = join(portableDir, 'resources', 'app');

const ELECTRON_DIST_CANDIDATES = [
  join(desktopDir, 'node_modules', 'electron', 'dist'),
  join(repoRoot, 'node_modules', 'electron', 'dist'),
];

function findElectronDist() {
  for (const p of ELECTRON_DIST_CANDIDATES) {
    if (existsSync(join(p, 'electron.exe'))) return p;
  }
  return null;
}

const ELECTRON_DIST = findElectronDist();

async function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
  });
}

async function main() {
  console.log('==> Cleaning release/ ...');
  await rm(releaseDir, { recursive: true, force: true });
  await mkdir(portableDir, { recursive: true });

  console.log('==> Running electron-vite build...');
  await run('pnpm', ['exec', 'electron-vite', 'build'], { cwd: desktopDir });

  if (!ELECTRON_DIST) {
    throw new Error(
      `Could not find Electron runtime. Tried:\n  - ${ELECTRON_DIST_CANDIDATES.join('\n  - ')}\nRun \`pnpm install\` from the repo root.`,
    );
  }

  console.log('==> Copying Electron runtime...');
  await cp(ELECTRON_DIST, portableDir, { recursive: true });

  // Rename electron.exe -> SkyMessage.exe
  const electronExe = join(portableDir, 'electron.exe');
  const skymessageExe = join(portableDir, 'SkyMessage.exe');
  if (existsSync(electronExe)) {
    await rename(electronExe, skymessageExe);
    console.log('    Renamed electron.exe -> SkyMessage.exe');
  }

  console.log('==> Staging app code into resources/app...');
  await mkdir(appResources, { recursive: true });
  await cp(join(desktopDir, 'out'), appResources, { recursive: true });

  // Write a minimal package.json so Electron knows the entry point.
  const pkg = JSON.parse(await readFile(join(desktopDir, 'package.json'), 'utf8'));
  await writeFile(
    join(appResources, 'package.json'),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        main: 'main/index.js',
        type: pkg.type,
      },
      null,
      2,
    ),
  );

  // Copy assets (tray icon etc.) if present.
  const assetsSrc = join(desktopDir, 'assets');
  if (existsSync(assetsSrc)) {
    await cp(assetsSrc, join(appResources, 'assets'), { recursive: true });
  }

  // Friendly README inside the portable folder
  await writeFile(
    join(portableDir, 'README-RUN-ME.txt'),
    [
      'SkyMessage (portable build)',
      '',
      '  1. Double-click SkyMessage.exe',
      '  2. Sign in (or create an account) when the login window appears',
      '  3. A SkyMessage icon will live in your system tray',
      '  4. Banners fly across your screen when you unlock your PC',
      '',
      'Want it to launch on Windows login automatically?',
      '  Right-click the tray icon -> "Launch on startup"',
      '',
    ].join('\r\n'),
  );

  const sizeMB = (folderSize(portableDir) / (1024 * 1024)).toFixed(0);
  console.log(`==> Portable app ready: ${portableDir} (~${sizeMB} MB)`);
  console.log('==> Zip it manually via Explorer -> Send to -> Compressed (zipped) folder,');
  console.log('    OR run:  Compress-Archive -Path release/SkyMessage-portable -DestinationPath release/SkyMessage-Win64.zip');
}

function folderSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const p = stack.pop();
    const s = statSync(p);
    if (s.isDirectory()) {
      for (const e of readdirSync(p)) stack.push(join(p, e));
    } else {
      total += s.size;
    }
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
