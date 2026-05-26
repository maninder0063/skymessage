/**
 * Lightweight in-memory rate-limit store keyed by `${bucket}:${key}` with a
 * sliding window. Single-process only — swap for Redis when scaling out.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function consume(
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const id = `${bucket}:${key}`;
  const now = Date.now();
  const existing = buckets.get(id);

  if (!existing || existing.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

// Periodic cleanup so the map doesn't grow forever.
setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  },
  5 * 60 * 1000,
).unref();
