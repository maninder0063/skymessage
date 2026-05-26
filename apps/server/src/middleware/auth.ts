import type { Context, MiddlewareHandler, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { User as AuthUser } from '@supabase/supabase-js';
import { getSupabase } from '../supabase.js';

export interface AuthContext {
  authUser: AuthUser;
  userId: string;       // public.users.id
  handle: string;
  displayName: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * Required auth middleware. Reads a Supabase access token from the Authorization
 * header, validates it via the service-role client, then looks up the matching
 * public.users row. Attaches { authUser, userId, handle } to ctx.var.auth.
 */
export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) {
    throw new HTTPException(401, { message: 'Missing Bearer token' });
  }
  const token = header.slice(7).trim();
  if (!token) throw new HTTPException(401, { message: 'Empty Bearer token' });

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new HTTPException(401, { message: 'Invalid or expired session' });
  }

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, handle, display_name')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (userErr) throw new HTTPException(500, { message: userErr.message });
  if (!userRow) {
    throw new HTTPException(409, {
      message: 'Auth user has no SkyMessage profile yet. POST /api/users/init first.',
    });
  }

  c.set('auth', {
    authUser: data.user,
    userId: userRow.id,
    handle: userRow.handle,
    displayName: userRow.display_name,
  });

  await next();
};

/**
 * Optional auth — populates ctx.var.auth if a valid token is present, but
 * never rejects. Used by /api/messages so signed-in senders get their handle
 * attached automatically while anonymous senders still work.
 */
export const optionalAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return next();
  const token = header.slice(7).trim();
  if (!token) return next();

  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return next();

  const { data: userRow } = await supabase
    .from('users')
    .select('id, handle, display_name')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (userRow) {
    c.set('auth', {
      authUser: data.user,
      userId: userRow.id,
      handle: userRow.handle,
      displayName: userRow.display_name,
    });
  }
  return next();
};
