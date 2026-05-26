import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  PORT: parseInt(optional('SERVER_PORT', '8787'), 10),
  HOST: optional('SERVER_HOST', '0.0.0.0'),
  ALLOWED_ORIGINS: optional('ALLOWED_ORIGINS', 'http://localhost:3000,app://skymessage')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  IS_PROD: process.env.NODE_ENV === 'production',
};
