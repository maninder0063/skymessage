import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Long-lived per-install config. The signed-in user (id / handle / display
 * name) is NOT stored here — those come from `auth.ts` after sign-in. This
 * file only holds settings that survive sign-out.
 */
interface InstallConfig {
  deviceId: string;
  apiBaseUrl: string;
  animationsEnabled: boolean;
}

function configPath(): string {
  return join(app.getPath('userData'), 'skymessage.config.json');
}

let cached: InstallConfig | null = null;

export async function loadConfig(apiBaseUrl: string): Promise<InstallConfig> {
  if (cached) return cached;

  const path = configPath();
  if (existsSync(path)) {
    try {
      const raw = await readFile(path, 'utf8');
      cached = { ...defaults(apiBaseUrl), ...(JSON.parse(raw) as Partial<InstallConfig>) };
      return cached;
    } catch {
      // fall through
    }
  }
  cached = defaults(apiBaseUrl);
  await saveConfig(cached);
  return cached;
}

export async function saveConfig(next: InstallConfig): Promise<void> {
  cached = next;
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

export function getCachedConfig(): InstallConfig | null {
  return cached;
}

function defaults(apiBaseUrl: string): InstallConfig {
  return {
    deviceId: randomUUID(),
    apiBaseUrl,
    animationsEnabled: true,
  };
}

export type { InstallConfig };
