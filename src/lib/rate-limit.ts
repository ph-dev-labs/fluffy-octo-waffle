import "server-only";

// Fixed-window in-memory limiter. Good enough for a single instance / dev.
// For multi-instance production deploys swap the store for Redis/Upstash
// (same interface) so limits are shared across instances.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    lastSweep = now;
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  bucket.count += 1;
  const ok = bucket.count <= limit;
  return { ok, remaining: Math.max(0, limit - bucket.count), retryAfterSec: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000) };
}
