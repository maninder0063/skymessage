import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabase } from '../supabase.js';
import { apiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

export const devicesRoute = new Hono();

const HeartbeatInput = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(['windows', 'macos', 'linux']),
  appVersion: z.string().min(1).max(32),
});

/**
 * POST /api/devices/heartbeat
 *
 * Authenticated. The signed-in user's id is used as the recipient id; the
 * desktop never sends user_id, removing the spoofing risk and keeping the
 * payload smaller.
 */
devicesRoute.post('/heartbeat', requireAuth, async (c) => {
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

  if (error) return apiError('internal', error.message, 500);
  return c.json({ ok: true });
});
