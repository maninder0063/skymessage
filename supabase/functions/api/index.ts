/**
 * SkyMessage API — Supabase Edge Function (Deno runtime).
 *
 * Single function `api` mounts the full Hono app. Public URL:
 *   https://<PROJECT-REF>.supabase.co/functions/v1/api/...
 *
 * Supabase auto-provides these env vars at runtime:
 *   - SUPABASE_URL
 *   - SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Set the rest via `supabase secrets set`:
 *   - ALLOWED_ORIGINS  (CSV)
 *
 * Deploy with `--no-verify-jwt` because /messages/send is intentionally
 * public for anonymous senders. We apply our own auth middleware
 * (`requireAuth`) on the routes that need it.
 */

// @ts-ignore - Deno-style npm: imports resolved at deploy time
import { Hono } from 'npm:hono@4.6.14';
// @ts-ignore
import { logger } from 'npm:hono@4.6.14/logger';
// @ts-ignore
import { cors } from 'npm:hono@4.6.14/cors';
// @ts-ignore
import { HTTPException } from 'npm:hono@4.6.14/http-exception';
// @ts-ignore
import { createClient, type SupabaseClient, type User as AuthUser } from 'npm:@supabase/supabase-js@2.47.10';
// @ts-ignore
import { z, ZodError } from 'npm:zod@3.23.8';

// ===================== env =====================

// @ts-ignore - Deno runtime global
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-ignore
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o: string) => o.trim())
  .filter(Boolean);

// ===================== supabase client (service role, bypasses RLS) =====================

let _client: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return _client;
}

// ===================== constants (copied from packages/shared) =====================

const MESSAGE_MAX_LENGTH = 80;
const MESSAGE_MIN_LENGTH = 1;
const MAX_MESSAGES_PER_SENDER_PER_DAY = 3;
const MAX_UNREAD_PER_RECIPIENT = 5;
const SEND_COOLDOWN_SECONDS = 20;
const DUPLICATE_WINDOW_HOURS = 24;

// ===================== validation (copied from packages/shared) =====================

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;
const HandleSchema = z
  .string()
  .min(2)
  .max(30)
  .regex(HANDLE_RE, 'Handle must be lowercase letters, digits, hyphen, or underscore.');
const DisplayNameSchema = z.string().trim().min(1).max(40);
const MessageBodySchema = z.string().trim().min(MESSAGE_MIN_LENGTH).max(MESSAGE_MAX_LENGTH);

const SendMessageInput = z.object({
  recipientHandle: HandleSchema,
  senderDisplayName: DisplayNameSchema,
  senderHandle: HandleSchema.optional(),
  body: MessageBodySchema,
  scheduledDeliveryAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine(
      (iso: string | undefined) => !iso || new Date(iso).getTime() > Date.now() - 60_000,
      'Scheduled delivery must be in the future.',
    )
    .refine(
      (iso: string | undefined) => !iso || new Date(iso).getTime() < Date.now() + 1000 * 60 * 60 * 24 * 90,
      'Scheduled delivery must be within 90 days.',
    ),
});

const BlockSenderInput = z
  .object({
    blockedHandle: HandleSchema.optional(),
    blockedEmail: z.string().email().optional(),
    reason: z.string().max(200).optional(),
  })
  .refine((v: { blockedHandle?: string; blockedEmail?: string }) => v.blockedHandle || v.blockedEmail, {
    message: 'Must provide blockedHandle or blockedEmail.',
  });

const HeartbeatInput = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(['windows', 'macos', 'linux']),
  appVersion: z.string().min(1).max(32),
});

const InitProfileInput = z.object({
  handle: HandleSchema,
  displayName: DisplayNameSchema,
  timezone: z.string().min(1).max(64).default('UTC'),
});

// ===================== profanity (copied from packages/shared) =====================

const BASE_DENY = new Set<string>([
  'fuck', 'fucking', 'shit', 'bitch', 'cunt', 'asshole', 'dick', 'pussy',
  'bastard', 'nigger', 'faggot', 'retard', 'whore', 'slut',
]);
const LEET_MAP: Record<string, string> = {
  '0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i',
};
function normalize(token: string): string {
  return token.toLowerCase().split('').map((ch) => LEET_MAP[ch] ?? ch).join('').replace(/[^a-z]/g, '');
}
function checkProfanity(text: string): { clean: boolean; matched: string[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const matched: string[] = [];
  for (const raw of tokens) {
    const norm = normalize(raw);
    if (!norm) continue;
    if (BASE_DENY.has(norm)) { matched.push(raw); continue; }
    for (const word of BASE_DENY) {
      if (word.length >= 4 && norm.includes(word)) { matched.push(raw); break; }
    }
  }
  return { clean: matched.length === 0, matched };
}

// ===================== timezone helper =====================

function hourInTimezone(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p: { type: string }) => p.type === 'hour')?.value ?? '0';
  const n = parseInt(hour, 10);
  return n === 24 ? 0 : n;
}
function isQuietHour(date: Date, tz: string, qs: number | null, qe: number | null): boolean {
  if (qs === null || qe === null) return false;
  const h = hourInTimezone(date, tz);
  if (qs === qe) return false;
  if (qs < qe) return h >= qs && h < qe;
  return h >= qs || h < qe;
}

// ===================== anti-spam =====================

interface SpamInput {
  sentToRecipientToday: number;
  secondsSinceLastSend: number | null;
  duplicateInWindow: boolean;
  recipientUnreadCount: number;
  isBlocked: boolean;
  notAllowedBySetting: boolean;
}
type SpamCode = 'ok' | 'rate_limited' | 'cooldown' | 'duplicate' | 'queue_full' | 'blocked';
interface SpamResult { ok: boolean; code: SpamCode; reason?: string; retryAfterSeconds?: number; }
function evaluateSpam(input: SpamInput): SpamResult {
  if (input.isBlocked || input.notAllowedBySetting) return { ok: false, code: 'blocked', reason: 'Recipient does not accept messages from this sender.' };
  if (input.sentToRecipientToday >= MAX_MESSAGES_PER_SENDER_PER_DAY) {
    return { ok: false, code: 'rate_limited', reason: `Daily limit reached (${MAX_MESSAGES_PER_SENDER_PER_DAY} per recipient).`, retryAfterSeconds: secondsUntilMidnight() };
  }
  if (input.secondsSinceLastSend !== null && input.secondsSinceLastSend < SEND_COOLDOWN_SECONDS) {
    return { ok: false, code: 'cooldown', reason: 'Slow down — wait a moment before sending again.', retryAfterSeconds: SEND_COOLDOWN_SECONDS - input.secondsSinceLastSend };
  }
  if (input.duplicateInWindow) return { ok: false, code: 'duplicate', reason: `Already sent that exact message in the last ${DUPLICATE_WINDOW_HOURS}h.` };
  if (input.recipientUnreadCount >= MAX_UNREAD_PER_RECIPIENT) return { ok: false, code: 'queue_full', reason: `Recipient already has ${MAX_UNREAD_PER_RECIPIENT} unread banners waiting.` };
  return { ok: true, code: 'ok' };
}
function secondsUntilMidnight(): number {
  const now = new Date();
  const tom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.floor((tom.getTime() - now.getTime()) / 1000));
}

// ===================== sha256 (Web Crypto, replaces node:crypto) =====================

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ===================== in-memory rate-limit (per-Worker instance) =====================

const buckets = new Map<string, { count: number; resetAt: number }>();
function consume(bucket: string, key: string, limit: number, windowSeconds: number) {
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const ex = buckets.get(id);
  if (!ex || ex.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (ex.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((ex.resetAt - now) / 1000) };
  }
  ex.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ===================== auth middleware =====================

interface AuthContext { authUser: AuthUser; userId: string; handle: string; displayName: string; }

async function loadAuth(c: any): Promise<AuthContext | null> {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await supabase
    .from('users')
    .select('id, handle, display_name')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();
  if (!row) return null;
  return { authUser: data.user, userId: row.id, handle: row.handle, displayName: row.display_name };
}

async function requireAuth(c: any, next: () => Promise<void>) {
  const auth = await loadAuth(c);
  if (!auth) throw new HTTPException(401, { message: 'Sign in required.' });
  c.set('auth', auth);
  await next();
}

async function optionalAuth(c: any, next: () => Promise<void>) {
  const auth = await loadAuth(c);
  if (auth) c.set('auth', auth);
  await next();
}

// ===================== app =====================

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin: string) => {
      if (!origin) return null;
      if (origin.startsWith('app://') || origin.startsWith('file://')) return origin;
      // Allow any origin if ALLOWED_ORIGINS empty (dev), else strict allow-list
      if (ALLOWED_ORIGINS.length === 0) return origin;
      return ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Client-Version', 'apikey'],
    maxAge: 600,
  }),
);

// ----- error envelope -----
app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'invalid_input', message: err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') } }, 400);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: err.status === 404 ? 'not_found' : err.status === 403 ? 'forbidden' : err.status === 401 ? 'invalid_input' : 'internal', message: err.message } }, err.status);
  }
  console.error('[api] unhandled', err);
  return c.json({ error: { code: 'internal', message: 'Internal server error' } }, 500);
});

// =========================================================================
// ROUTES — Supabase Edge Functions deliver the FULL request path to the
// function (no stripping). With function name `api`, clients hit
// `https://<ref>.supabase.co/functions/v1/api/...` and Hono sees `/api/...`.
// So every route below carries the `/api` prefix.
// Client base URL: https://<ref>.supabase.co/functions/v1
// Client calls `/api/health` -> arrives here as `/api/health`.
// =========================================================================

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'skymessage-edge', time: new Date().toISOString() }));

// ----- auth -----
app.post('/api/auth/init-bootstrap', async (c) => {
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) throw new HTTPException(401, { message: 'Missing Bearer token' });
  const token = header.slice(7).trim();
  const supabase = getSupabase();
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData.user) throw new HTTPException(401, { message: 'Invalid session' });
  const input = InitProfileInput.parse(await c.req.json());

  const { data: existing } = await supabase.from('users')
    .select('id, handle, display_name, email, timezone, theme')
    .eq('auth_user_id', authData.user.id).maybeSingle();
  if (existing) return c.json({ user: existing, created: false });

  const { data: handleTaken } = await supabase.from('users')
    .select('id').eq('handle', input.handle.toLowerCase()).maybeSingle();
  if (handleTaken) return c.json({ error: { code: 'invalid_input', message: `Handle "${input.handle}" is already taken.` } }, 400);

  const { data: created, error: insErr } = await supabase.from('users').insert({
    auth_user_id: authData.user.id,
    handle: input.handle.toLowerCase(),
    display_name: input.displayName,
    email: authData.user.email ?? null,
    timezone: input.timezone,
  }).select('id, handle, display_name, email, timezone, theme').single();
  if (insErr) return c.json({ error: { code: 'internal', message: insErr.message } }, 500);
  return c.json({ user: created, created: true });
});

app.get('/api/auth/me', requireAuth, async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { data } = await supabase.from('users')
    .select('id, handle, display_name, email, avatar_url, timezone, theme')
    .eq('id', auth.userId).single();
  return c.json({ user: data });
});

// ----- users -----
app.get('/api/users/:handle', async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users')
    .select('id, handle, display_name, avatar_url, theme')
    .eq('handle', handle).maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'User not found' });
  const [{ data: settings }, { data: device }] = await Promise.all([
    supabase.from('settings').select('allowed_senders_only').eq('user_id', data.id).maybeSingle(),
    supabase.from('devices').select('last_seen_at').eq('user_id', data.id)
      .order('last_seen_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return c.json({
    user: { id: data.id, handle: data.handle, displayName: data.display_name, avatarUrl: data.avatar_url, theme: data.theme },
    acceptsMessages: true,
    acceptsAnonymous: !(settings?.allowed_senders_only ?? false),
    lastSeenAt: device?.last_seen_at ?? null,
    isOnline: device?.last_seen_at ? Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60_000 : false,
  });
});

app.post('/api/users/:handle/block', requireAuth, async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const auth = c.get('auth');
  if (auth.handle !== handle) return c.json({ error: { code: 'forbidden', message: 'You can only block on your own account.' } }, 403);
  const input = BlockSenderInput.parse(await c.req.json());
  const supabase = getSupabase();
  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: auth.userId,
    blocked_handle: input.blockedHandle ?? null,
    blocked_email: input.blockedEmail ?? null,
    reason: input.reason ?? null,
  });
  if (error) {
    if (error.code === '23505') return c.json({ ok: true, alreadyBlocked: true });
    return c.json({ error: { code: 'internal', message: error.message } }, 500);
  }
  return c.json({ ok: true });
});

// ----- devices -----
app.post('/api/devices/heartbeat', requireAuth, async (c) => {
  const input = HeartbeatInput.parse(await c.req.json());
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { error } = await supabase.from('devices').upsert(
    {
      user_id: auth.userId,
      device_id: input.deviceId,
      platform: input.platform,
      app_version: input.appVersion,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' },
  );
  if (error) return c.json({ error: { code: 'internal', message: error.message } }, 500);
  return c.json({ ok: true });
});

// ----- messages -----
app.post('/api/messages', optionalAuth, async (c) => {
  const rawInput = await c.req.json();
  const auth = c.get('auth');
  if (auth) {
    rawInput.senderHandle = auth.handle;
    rawInput.senderDisplayName = auth.displayName;
  }
  const input = SendMessageInput.parse(rawInput);
  const supabase = getSupabase();
  const ipHash = await sha256Hex((c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown') + '|skymessage-salt');

  const burst = consume('ip', ipHash, 30, 60);
  if (!burst.allowed) return c.json({ error: { code: 'rate_limited', message: 'Too many requests from this IP.', retryAfterSeconds: burst.retryAfterSeconds } }, 429);

  const { data: recipient, error: recErr } = await supabase.from('users')
    .select('id, handle, timezone, theme, display_name, avatar_url')
    .eq('handle', input.recipientHandle.toLowerCase()).maybeSingle();
  if (recErr) throw new HTTPException(500, { message: recErr.message });
  if (!recipient) return c.json({ error: { code: 'not_found', message: 'Recipient not found.' } }, 404);

  let senderId: string | null = null;
  if (input.senderHandle) {
    const { data: sender } = await supabase.from('users').select('id').eq('handle', input.senderHandle.toLowerCase()).maybeSingle();
    senderId = sender?.id ?? null;
  }
  const isAnonymous = !input.senderHandle;
  const senderIdentifier = senderId ?? input.senderHandle ?? `anon:${ipHash}`;

  const [settingsResp, blockedResp, dupResp, unreadResp, lastSendResp, dailyResp] = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', recipient.id).maybeSingle(),
    supabase.from('blocked_users').select('id').eq('blocker_id', recipient.id).or(
      [
        senderId ? `blocked_user_id.eq.${senderId}` : null,
        input.senderHandle ? `blocked_handle.eq.${input.senderHandle.toLowerCase()}` : null,
      ].filter(Boolean).join(',') || 'id.eq.00000000-0000-0000-0000-000000000000',
    ).limit(1),
    supabase.from('messages').select('id').eq('recipient_id', recipient.id).eq('body', input.body.trim())
      .gte('created_at', new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600_000).toISOString()).limit(1),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', recipient.id).is('delivered_at', null),
    supabase.from('messages').select('created_at')
      .eq('recipient_id', recipient.id)
      .eq(senderId ? 'sender_id' : 'sender_display_name', senderId ?? input.senderDisplayName)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    countSentToday(senderIdentifier, recipient.id),
  ]);

  const blocked = (blockedResp.data?.length ?? 0) > 0;
  const allowedSendersOnly = settingsResp.data?.allowed_senders_only ?? false;
  const profStrict = settingsResp.data?.profanity_strict ?? true;

  if (profStrict) {
    const prof = checkProfanity(input.body);
    if (!prof.clean) return c.json({ error: { code: 'profanity', message: `Message contains disallowed words: ${prof.matched.join(', ')}` } }, 400);
  }

  const lastSendAt = lastSendResp.data?.created_at ? new Date(lastSendResp.data.created_at) : null;
  const secondsSinceLastSend = lastSendAt ? Math.floor((Date.now() - lastSendAt.getTime()) / 1000) : null;

  const decision = evaluateSpam({
    sentToRecipientToday: dailyResp,
    secondsSinceLastSend,
    duplicateInWindow: (dupResp.data?.length ?? 0) > 0,
    recipientUnreadCount: unreadResp.count ?? 0,
    isBlocked: blocked,
    notAllowedBySetting: allowedSendersOnly && !senderId,
  });
  if (!decision.ok) {
    const code = decision.code === 'cooldown' ? 'rate_limited' : decision.code;
    const status = (code === 'rate_limited' ? 429 : code === 'blocked' ? 403 : 400) as 400 | 403 | 429;
    return c.json({ error: { code, message: decision.reason ?? 'Blocked.', retryAfterSeconds: decision.retryAfterSeconds } }, status);
  }

  const { data: created, error: insErr } = await supabase.from('messages').insert({
    sender_id: senderId,
    sender_display_name: input.senderDisplayName,
    recipient_id: recipient.id,
    body: input.body.trim(),
    scheduled_delivery_at: input.scheduledDeliveryAt ?? new Date().toISOString(),
    is_anonymous: isAnonymous,
    sender_ip_hash: ipHash,
  }).select('id, recipient_id, scheduled_delivery_at, created_at').single();
  if (insErr) return c.json({ error: { code: 'internal', message: insErr.message } }, 500);

  await bumpRateLimit(senderIdentifier, recipient.id);

  return c.json({
    message: {
      id: created.id,
      recipientId: created.recipient_id,
      scheduledDeliveryAt: created.scheduled_delivery_at,
      createdAt: created.created_at,
    },
  }, 201);
});

app.get('/api/messages/pending', requireAuth, async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { data: user, error: userErr } = await supabase.from('users')
    .select('id, handle, display_name, avatar_url, theme, timezone')
    .eq('id', auth.userId).maybeSingle();
  if (userErr) throw new HTTPException(500, { message: userErr.message });
  if (!user) return c.json({ error: { code: 'not_found', message: 'User not found' } }, 404);

  const { data: settings } = await supabase.from('settings').select('*').eq('user_id', auth.userId).maybeSingle();

  const recipient = { id: user.id, handle: user.handle, displayName: user.display_name, avatarUrl: user.avatar_url, theme: user.theme, timezone: user.timezone };
  const empty = { recipient, messages: [], serverTime: new Date().toISOString() };

  if (settings?.animations_paused_until && new Date(settings.animations_paused_until) > new Date()) return c.json(empty);
  if (settings && isQuietHour(new Date(), user.timezone, settings.quiet_hours_start, settings.quiet_hours_end)) return c.json(empty);

  const cap = settings?.max_queue_per_unlock ?? 5;
  const { data: messages, error: msgErr } = await supabase.from('messages').select('*')
    .eq('recipient_id', auth.userId).is('delivered_at', null)
    .lte('scheduled_delivery_at', new Date().toISOString())
    .order('scheduled_delivery_at', { ascending: true }).limit(cap);
  if (msgErr) throw new HTTPException(500, { message: msgErr.message });

  return c.json({
    recipient,
    messages: (messages ?? []).map((m: any) => ({
      id: m.id, body: m.body,
      senderDisplayName: m.sender_display_name,
      isAnonymous: m.is_anonymous,
      createdAt: m.created_at,
      theme: user.theme,
    })),
    serverTime: new Date().toISOString(),
  });
});

app.post('/api/messages/:id/delivered', requireAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { error } = await supabase.from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', id).eq('recipient_id', auth.userId).is('delivered_at', null);
  if (error) return c.json({ error: { code: 'internal', message: error.message } }, 500);
  return c.json({ ok: true });
});

app.post('/api/messages/:id/read', requireAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { error } = await supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id).eq('recipient_id', auth.userId);
  if (error) return c.json({ error: { code: 'internal', message: error.message } }, 500);
  return c.json({ ok: true });
});

app.get('/api/messages/history', requireAuth, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { data, error } = await supabase.from('messages').select('*')
    .eq('recipient_id', auth.userId)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json({ messages: data ?? [] });
});

// 404 fallback
app.notFound((c) => c.json({ error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` } }, 404));

// ===================== helpers =====================

async function countSentToday(senderIdentifier: string, recipientId: string): Promise<number> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('rate_limits')
    .select('count')
    .eq('sender_identifier', senderIdentifier)
    .eq('recipient_id', recipientId)
    .eq('day', today).maybeSingle();
  return data?.count ?? 0;
}

async function bumpRateLimit(senderIdentifier: string, recipientId: string): Promise<void> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase.from('rate_limits')
    .select('id, count')
    .eq('sender_identifier', senderIdentifier)
    .eq('recipient_id', recipientId)
    .eq('day', today).maybeSingle();
  if (existing) {
    await supabase.from('rate_limits').update({ count: existing.count + 1, last_sent_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('rate_limits').insert({ sender_identifier: senderIdentifier, recipient_id: recipientId, day: today, count: 1 });
  }
}

// ===================== entry =====================

// @ts-ignore - Deno global
Deno.serve(app.fetch);
