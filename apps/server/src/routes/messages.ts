import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createHash } from 'node:crypto';
import type {
  PendingMessagesResponse,
  SendMessageResponse,
} from '@skymessage/types';
import { SendMessageInput } from '@skymessage/shared/validation';
import { checkProfanity } from '@skymessage/shared/profanity';
import { evaluateSpam } from '@skymessage/shared/anti-spam';
import {
  DUPLICATE_WINDOW_HOURS,
  MAX_MESSAGES_PER_SENDER_PER_DAY,
  MAX_UNREAD_PER_RECIPIENT,
  SEND_COOLDOWN_SECONDS,
} from '@skymessage/shared/constants';
import { isQuietHour } from '@skymessage/shared/timezone';
import { getSupabase } from '../supabase.js';
import { mapMessage, mapUserPublic, type MessageRow, type UserRow } from '../db-mappers.js';
import { apiError } from '../middleware/error.js';
import { consume } from '../rate-limit-store.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export const messagesRoute = new Hono();

/**
 * POST /api/messages
 * Send a message. Anonymous if no auth token is present and no senderHandle.
 * Signed-in users have their handle/displayName attached automatically.
 */
messagesRoute.post('/', optionalAuth, async (c) => {
  const rawInput = await c.req.json();
  const auth = c.get('auth');
  // If signed in, force the sender identity to match the token.
  if (auth) {
    rawInput.senderHandle = auth.handle;
    rawInput.senderDisplayName = auth.displayName;
  }
  const input = SendMessageInput.parse(rawInput);
  const supabase = getSupabase();
  const ipHash = hashIp(c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown');

  // Per-IP burst limit independent of per-sender daily limit.
  const burst = consume('ip', ipHash, 30, 60);
  if (!burst.allowed) {
    return apiError('rate_limited', 'Too many requests from this IP.', 429, burst.retryAfterSeconds);
  }

  // 1. Recipient lookup
  const { data: recipient, error: recErr } = await supabase
    .from('users')
    .select('id, handle, timezone, theme, display_name, avatar_url')
    .eq('handle', input.recipientHandle.toLowerCase())
    .maybeSingle();

  if (recErr) throw new HTTPException(500, { message: recErr.message });
  if (!recipient) return apiError('not_found', 'Recipient not found.', 404);

  // 2. Optional sender lookup
  let senderId: string | null = null;
  if (input.senderHandle) {
    const { data: sender } = await supabase
      .from('users')
      .select('id')
      .eq('handle', input.senderHandle.toLowerCase())
      .maybeSingle();
    senderId = sender?.id ?? null;
  }
  const isAnonymous = !input.senderHandle;
  const senderIdentifier = senderId ?? input.senderHandle ?? `anon:${ipHash}`;

  // 3. Recipient settings + block list + duplicates + counters
  const [settingsResp, blockedResp, dupResp, unreadResp, lastSendResp, dailyResp] = await Promise.all([
    supabase.from('settings').select('*').eq('user_id', recipient.id).maybeSingle(),
    supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', recipient.id)
      .or(
        [
          senderId ? `blocked_user_id.eq.${senderId}` : null,
          input.senderHandle ? `blocked_handle.eq.${input.senderHandle.toLowerCase()}` : null,
        ]
          .filter(Boolean)
          .join(',') || 'id.eq.00000000-0000-0000-0000-000000000000',
      )
      .limit(1),
    supabase
      .from('messages')
      .select('id')
      .eq('recipient_id', recipient.id)
      .eq('body', input.body.trim())
      .gte('created_at', new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600_000).toISOString())
      .limit(1),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipient.id)
      .is('delivered_at', null),
    supabase
      .from('messages')
      .select('created_at')
      .eq('recipient_id', recipient.id)
      .eq(senderId ? 'sender_id' : 'sender_display_name', senderId ?? input.senderDisplayName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    countSentToday(senderIdentifier, recipient.id),
  ]);

  const blocked = (blockedResp.data?.length ?? 0) > 0;
  const allowedSendersOnly = settingsResp.data?.allowed_senders_only ?? false;

  // Profanity
  const profStrict = settingsResp.data?.profanity_strict ?? true;
  if (profStrict) {
    const prof = checkProfanity(input.body);
    if (!prof.clean) {
      return apiError('profanity', `Message contains disallowed words: ${prof.matched.join(', ')}`, 400);
    }
  }

  // Spam evaluation
  const lastSendAt = lastSendResp.data?.created_at
    ? new Date(lastSendResp.data.created_at)
    : null;
  const secondsSinceLastSend = lastSendAt
    ? Math.floor((Date.now() - lastSendAt.getTime()) / 1000)
    : null;

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
    // After the !decision.ok narrowing, code is one of the non-'ok' variants
    // — but TS can't see through evaluateSpam's return shape, so we assert.
    const apiCode = code as Exclude<typeof code, 'ok'>;
    const status =
      apiCode === 'rate_limited' ? 429 : apiCode === 'blocked' ? 403 : 400;
    return apiError(apiCode, decision.reason ?? 'Blocked.', status, decision.retryAfterSeconds);
  }

  // 4. Insert message
  const { data: created, error: insErr } = await supabase
    .from('messages')
    .insert({
      sender_id: senderId,
      sender_display_name: input.senderDisplayName,
      recipient_id: recipient.id,
      body: input.body.trim(),
      scheduled_delivery_at: input.scheduledDeliveryAt ?? new Date().toISOString(),
      is_anonymous: isAnonymous,
      sender_ip_hash: ipHash,
    })
    .select('id, recipient_id, scheduled_delivery_at, created_at')
    .single();

  if (insErr) return apiError('internal', insErr.message, 500);

  // 5. Bump rate-limit counter
  await bumpRateLimit(senderIdentifier, recipient.id);

  const body: SendMessageResponse = {
    message: {
      id: created.id,
      recipientId: created.recipient_id,
      scheduledDeliveryAt: created.scheduled_delivery_at,
      createdAt: created.created_at,
    },
  };
  return c.json(body, 201);
});

/**
 * GET /api/messages/pending
 * Authenticated. Returns the signed-in user's pending banners.
 */
messagesRoute.get('/pending', requireAuth, async (c) => {
  const auth = c.get('auth');
  const userId = auth.userId;
  const supabase = getSupabase();

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, handle, display_name, avatar_url, theme, timezone')
    .eq('id', userId)
    .maybeSingle();

  if (userErr) throw new HTTPException(500, { message: userErr.message });
  if (!user) return apiError('not_found', 'User not found', 404);

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Animations paused?
  if (settings?.animations_paused_until && new Date(settings.animations_paused_until) > new Date()) {
    return c.json<PendingMessagesResponse>({
      recipient: { ...mapUserPublic(user as Pick<UserRow, 'id' | 'handle' | 'display_name' | 'avatar_url' | 'theme'>), timezone: user.timezone },
      messages: [],
      serverTime: new Date().toISOString(),
    });
  }

  // Quiet hours?
  if (
    settings &&
    isQuietHour(new Date(), user.timezone, settings.quiet_hours_start, settings.quiet_hours_end)
  ) {
    return c.json<PendingMessagesResponse>({
      recipient: { ...mapUserPublic(user as Pick<UserRow, 'id' | 'handle' | 'display_name' | 'avatar_url' | 'theme'>), timezone: user.timezone },
      messages: [],
      serverTime: new Date().toISOString(),
    });
  }

  const cap = settings?.max_queue_per_unlock ?? 5;

  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('*')
    .eq('recipient_id', userId)
    .is('delivered_at', null)
    .lte('scheduled_delivery_at', new Date().toISOString())
    .order('scheduled_delivery_at', { ascending: true })
    .limit(cap);

  if (msgErr) throw new HTTPException(500, { message: msgErr.message });

  const body: PendingMessagesResponse = {
    recipient: {
      ...mapUserPublic(user as Pick<UserRow, 'id' | 'handle' | 'display_name' | 'avatar_url' | 'theme'>),
      timezone: user.timezone,
    },
    messages: (messages ?? []).map(mapMessage).map((m) => ({
      id: m.id,
      body: m.body,
      senderDisplayName: m.senderDisplayName,
      isAnonymous: m.isAnonymous,
      createdAt: m.createdAt,
      theme: user.theme,
    })),
    serverTime: new Date().toISOString(),
  };

  return c.json(body);
});

messagesRoute.post('/:id/delivered', requireAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', auth.userId)
    .is('delivered_at', null);
  if (error) return apiError('internal', error.message, 500);
  return c.json({ ok: true });
});

messagesRoute.post('/:id/read', requireAuth, async (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', auth.userId);
  if (error) return apiError('internal', error.message, 500);
  return c.json({ ok: true });
});

/**
 * GET /api/messages/history (for replay) — authenticated, own messages only.
 */
messagesRoute.get('/history', requireAuth, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('recipient_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json({ messages: (data as MessageRow[] | null ?? []).map(mapMessage) });
});

// ---------- helpers ----------

function hashIp(ip: string): string {
  return createHash('sha256').update(`${ip}|skymessage-salt`).digest('hex').slice(0, 32);
}

async function countSentToday(senderIdentifier: string, recipientId: string): Promise<number> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('sender_identifier', senderIdentifier)
    .eq('recipient_id', recipientId)
    .eq('day', today)
    .maybeSingle();
  return data?.count ?? 0;
}

async function bumpRateLimit(senderIdentifier: string, recipientId: string): Promise<void> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('rate_limits')
    .select('id, count')
    .eq('sender_identifier', senderIdentifier)
    .eq('recipient_id', recipientId)
    .eq('day', today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1, last_sent_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('rate_limits').insert({
      sender_identifier: senderIdentifier,
      recipient_id: recipientId,
      day: today,
      count: 1,
    });
  }
}

// Silence unused-import warnings — used implicitly via destructuring above.
void MAX_MESSAGES_PER_SENDER_PER_DAY;
void MAX_UNREAD_PER_RECIPIENT;
void SEND_COOLDOWN_SECONDS;
