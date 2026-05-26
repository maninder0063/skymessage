import { cors } from 'hono/cors';
import { env } from '../env.js';

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return null;
    // Electron renderer pages load from app:// or file:// in production
    if (origin.startsWith('app://') || origin.startsWith('file://')) return origin;
    return env.ALLOWED_ORIGINS.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Device-Id', 'X-Client-Version'],
  maxAge: 600,
  credentials: false,
});
