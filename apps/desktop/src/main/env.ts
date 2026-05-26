export const desktopEnv = {
  API_BASE_URL: process.env.DESKTOP_API_BASE_URL ?? 'http://localhost:8787',
  SUPABASE_URL: process.env.DESKTOP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.DESKTOP_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
  AUTO_LAUNCH: (process.env.DESKTOP_AUTO_LAUNCH ?? 'true').toLowerCase() === 'true',
  IS_DEV: !!process.env.ELECTRON_RENDERER_URL,
};
