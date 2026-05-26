import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { ApiError } from '@skymessage/types';

export const errorMiddleware: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    return handleError(c, err);
  }
};

function handleError(c: Context, err: unknown) {
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: 'invalid_input',
        message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
    };
    return c.json(body, 400);
  }
  if (err instanceof HTTPException) {
    const body: ApiError = {
      error: {
        code: err.status === 404 ? 'not_found' : err.status === 403 ? 'forbidden' : 'invalid_input',
        message: err.message,
      },
    };
    return c.json(body, err.status);
  }
  console.error('[server] unhandled error', err);
  const body: ApiError = {
    error: { code: 'internal', message: 'Internal server error' },
  };
  return c.json(body, 500);
}

export function apiError(
  code: ApiError['error']['code'],
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 = 400,
  retryAfterSeconds?: number,
): Response {
  const body: ApiError = {
    error: { code, message, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(retryAfterSeconds !== undefined ? { 'Retry-After': String(retryAfterSeconds) } : {}),
    },
  });
}
