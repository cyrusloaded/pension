/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-node deployments. Use Redis for multi-instance production.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

const CLEAN_INTERVAL_MS = 60_000;
let lastClean = Date.now();

function cleanup(now: number) {
  if (now - lastClean < CLEAN_INTERVAL_MS) return;
  lastClean = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSec: 0,
  };
}

/** Login: 20 attempts per IP per 15 minutes */
export function rateLimitLogin(ip: string): RateLimitResult {
  return rateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
}
