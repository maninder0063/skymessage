import { app, safeStorage } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

interface DesktopSessionMeta {
  userId: string;
  handle: string;
  displayName: string;
  email: string | null;
  timezone: string;
}

interface PersistedAuthFile {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;        // unix seconds
  meta: DesktopSessionMeta;
}

let supabase: SupabaseClient | null = null;
let currentSession: Session | null = null;
let currentMeta: DesktopSessionMeta | null = null;

export interface SkyAuthSnapshot {
  signedIn: boolean;
  meta: DesktopSessionMeta | null;
  accessToken: string | null;
}

export function getSupabaseClient(supabaseUrl: string, anonKey: string): SupabaseClient {
  if (supabase) return supabase;
  supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return supabase;
}

export function getAuthSnapshot(): SkyAuthSnapshot {
  return {
    signedIn: !!currentSession,
    meta: currentMeta,
    accessToken: currentSession?.access_token ?? null,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  if (!currentSession || !supabase) return null;
  const expiresAt = currentSession.expires_at ?? 0;
  // refresh 30s before expiry
  if (Date.now() / 1000 < expiresAt - 30) return currentSession.access_token;

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: currentSession.refresh_token,
  });
  if (error || !data.session) {
    await signOut();
    return null;
  }
  currentSession = data.session;
  await persist();
  return data.session.access_token;
}

export async function loadPersistedSession(): Promise<SkyAuthSnapshot> {
  const path = sessionPath();
  if (!existsSync(path)) return { signedIn: false, meta: null, accessToken: null };

  try {
    const raw = await readFile(path);
    const decrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8');
    const parsed = JSON.parse(decrypted) as PersistedAuthFile;

    if (!supabase) throw new Error('Supabase client not initialised');
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: parsed.refreshToken,
    });
    if (error || !data.session) {
      await signOut();
      return { signedIn: false, meta: null, accessToken: null };
    }
    currentSession = data.session;
    currentMeta = parsed.meta;
    await persist();
    return getAuthSnapshot();
  } catch (err) {
    console.error('[auth] failed to restore session', err);
    return { signedIn: false, meta: null, accessToken: null };
  }
}

export interface LoginInput { email: string; password: string; }

export async function signIn({ email, password }: LoginInput, apiBaseUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase client not initialised' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return { ok: false, error: error?.message ?? 'Sign-in failed' };

  currentSession = data.session;
  const profile = await fetchProfile(apiBaseUrl, data.session.access_token);
  if (!profile) {
    await signOut();
    return { ok: false, error: 'No SkyMessage profile for this account. Sign up on the website first.' };
  }
  currentMeta = profile;
  await persist();
  return { ok: true };
}

export interface SignupInput {
  email: string;
  password: string;
  handle: string;
  displayName: string;
  timezone: string;
}

export async function signUp(input: SignupInput, apiBaseUrl: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'Supabase client not initialised' };
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.displayName, handle: input.handle.toLowerCase() } },
  });
  if (error) return { ok: false, error: error.message };

  const token = data.session?.access_token;
  if (!token) {
    return { ok: false, error: 'Email confirmation required. Check your inbox and then sign in.' };
  }

  const initRes = await fetch(`${apiBaseUrl}/api/auth/init-bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      handle: input.handle.toLowerCase(),
      displayName: input.displayName,
      timezone: input.timezone,
    }),
  });
  if (!initRes.ok) {
    const body = (await initRes.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    return { ok: false, error: body?.error?.message ?? 'Could not create profile.' };
  }

  currentSession = data.session!;
  const profile = await fetchProfile(apiBaseUrl, token);
  if (!profile) return { ok: false, error: 'Created account but profile fetch failed.' };
  currentMeta = profile;
  await persist();
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (supabase) {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  }
  currentSession = null;
  currentMeta = null;
  const path = sessionPath();
  if (existsSync(path)) {
    try { await unlink(path); } catch { /* ignore */ }
  }
}

// ---------- helpers ----------

async function fetchProfile(apiBaseUrl: string, accessToken: string): Promise<DesktopSessionMeta | null> {
  const res = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const body = await res.json() as { user: { id: string; handle: string; display_name: string; email: string | null; timezone: string } };
  return {
    userId: body.user.id,
    handle: body.user.handle,
    displayName: body.user.display_name,
    email: body.user.email,
    timezone: body.user.timezone,
  };
}

async function persist(): Promise<void> {
  if (!currentSession || !currentMeta) return;
  const file: PersistedAuthFile = {
    accessToken: currentSession.access_token,
    refreshToken: currentSession.refresh_token,
    expiresAt: currentSession.expires_at ?? 0,
    meta: currentMeta,
  };
  const json = JSON.stringify(file);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');

  const path = sessionPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf, { mode: 0o600 });
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'skymessage.session');
}

export type { DesktopSessionMeta };
