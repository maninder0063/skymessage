import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PublicProfileResponse } from '@skymessage/types';
import { BlockSenderInput } from '@skymessage/shared/validation';
import { getSupabase } from '../supabase.js';
import { mapUserPublic, type UserRow } from '../db-mappers.js';
import { apiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRoute = new Hono();

/**
 * GET /api/users/:handle
 * Public profile page. Includes `lastSeenAt` so the UI can render
 * Online / "Last seen Xm ago" badges.
 */
usersRoute.get('/:handle', async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('id, handle, display_name, avatar_url, theme')
    .eq('handle', handle)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'User not found' });

  const [{ data: settings }, { data: device }] = await Promise.all([
    supabase
      .from('settings')
      .select('allowed_senders_only')
      .eq('user_id', data.id)
      .maybeSingle(),
    supabase
      .from('devices')
      .select('last_seen_at')
      .eq('user_id', data.id)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const body: PublicProfileResponse & { lastSeenAt: string | null; isOnline: boolean } = {
    user: mapUserPublic(data as Pick<UserRow, 'id' | 'handle' | 'display_name' | 'avatar_url' | 'theme'>),
    acceptsMessages: true,
    acceptsAnonymous: !(settings?.allowed_senders_only ?? false),
    lastSeenAt: device?.last_seen_at ?? null,
    isOnline: device?.last_seen_at
      ? Date.now() - new Date(device.last_seen_at).getTime() < 5 * 60_000
      : false,
  };
  return c.json(body);
});

/**
 * POST /api/users/:handle/block
 * Authenticated. Only the handle's owner can block on their own behalf.
 */
usersRoute.post('/:handle/block', requireAuth, async (c) => {
  const handle = c.req.param('handle').toLowerCase();
  const auth = c.get('auth');
  const input = BlockSenderInput.parse(await c.req.json());

  if (auth.handle !== handle) {
    return apiError('forbidden', 'You can only block on your own account.', 403);
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('blocked_users').insert({
    blocker_id: auth.userId,
    blocked_handle: input.blockedHandle ?? null,
    blocked_email: input.blockedEmail ?? null,
    reason: input.reason ?? null,
  });

  if (error) {
    if (error.code === '23505') return c.json({ ok: true, alreadyBlocked: true });
    return apiError('internal', error.message, 500);
  }
  return c.json({ ok: true });
});
