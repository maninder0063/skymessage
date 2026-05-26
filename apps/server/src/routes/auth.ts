import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { HandleSchema, DisplayNameSchema } from '@skymessage/shared/validation';
import { getSupabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { apiError } from '../middleware/error.js';

export const authRoute = new Hono();

const InitProfileInput = z.object({
  handle: HandleSchema,
  displayName: DisplayNameSchema,
  timezone: z.string().min(1).max(64).default('UTC'),
});

/**
 * POST /api/auth/init
 *
 * Called once right after `supabase.auth.signUp()` on the client. Creates
 * the public.users row tied to the auth user. Idempotent: if the row
 * already exists, returns the existing one.
 */
authRoute.post('/init', requireAuth, async (c) => {
  // requireAuth would normally 409 if there's no profile yet. We need to
  // run this BEFORE that check, so re-implement the relevant slice here.
  // (Easier: skip requireAuth and validate the JWT directly.)
  return c.json({ ok: false, message: 'Use /api/auth/init-bootstrap instead.' }, 400);
});

/**
 * POST /api/auth/init-bootstrap
 *
 * Same as /init but works when the public.users row doesn't exist yet.
 */
authRoute.post('/init-bootstrap', async (c) => {
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new HTTPException(401, { message: 'Missing Bearer token' });
  }
  const token = header.slice(7).trim();

  const supabase = getSupabase();
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData.user) {
    throw new HTTPException(401, { message: 'Invalid session' });
  }

  const input = InitProfileInput.parse(await c.req.json());

  // Already exists?
  const { data: existing } = await supabase
    .from('users')
    .select('id, handle, display_name, email, timezone, theme')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (existing) {
    return c.json({ user: existing, created: false });
  }

  // Handle collision check
  const { data: handleTaken } = await supabase
    .from('users')
    .select('id')
    .eq('handle', input.handle.toLowerCase())
    .maybeSingle();
  if (handleTaken) {
    return apiError('invalid_input', `Handle "${input.handle}" is already taken.`, 400);
  }

  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert({
      auth_user_id: authData.user.id,
      handle: input.handle.toLowerCase(),
      display_name: input.displayName,
      email: authData.user.email ?? null,
      timezone: input.timezone,
    })
    .select('id, handle, display_name, email, timezone, theme')
    .single();

  if (insErr) return apiError('internal', insErr.message, 500);
  return c.json({ user: created, created: true });
});

/**
 * GET /api/auth/me
 *
 * Returns the public.users row for the current session.
 */
authRoute.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth');
  const supabase = getSupabase();
  const { data } = await supabase
    .from('users')
    .select('id, handle, display_name, email, avatar_url, timezone, theme')
    .eq('id', auth.userId)
    .single();
  return c.json({ user: data });
});
