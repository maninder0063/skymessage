import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

/**
 * Bakes DESKTOP_* env vars into the main + preload bundles at build time so
 * one .exe ships with its configured backend URL. Read by `src/main/env.ts`.
 */
function envDefines() {
  const keys = ['DESKTOP_API_BASE_URL', 'DESKTOP_SUPABASE_URL', 'DESKTOP_SUPABASE_ANON_KEY', 'DESKTOP_AUTO_LAUNCH'];
  const out: Record<string, string> = {};
  for (const k of keys) {
    out[`process.env.${k}`] = JSON.stringify(process.env[k] ?? '');
  }
  return out;
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: envDefines(),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: envDefines(),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
      },
    },
  },
});
