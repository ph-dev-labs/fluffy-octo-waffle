import "server-only";
import { env } from "./env";
import { logger } from "./logger";

// Fixed-window rate limiter. With Upstash configured the counters live in
// Redis, so limits hold across every serverless instance. Without it (dev, or
// if Redis is unreachable) it falls back to a per-instance in-memory store —
// a rate limiter must never be the reason checkout goes down.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const REDIS_TIMEOUT_MS = 1_000;

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;

  let count: number | null = null;
  const redis = redisConfig();
  if (redis) {
    try {
      count = await redisIncr(redis, `rl:${key}:${windowStart}`, windowMs);
    } catch (err) {
      warnRedisDown(err);
    }
  }
  count ??= memoryIncr(key, resetAt, now);

  const ok = count <= limit;
  return { ok, remaining: Math.max(0, limit - count), retryAfterSec: ok ? 0 : Math.ceil((resetAt - now) / 1000) };
}

// ── Upstash (REST API, so it works from any runtime with no extra package) ──

interface RedisConfig {
  url: string;
  token: string;
}

function redisConfig(): RedisConfig | null {
  const e = env();
  // Upstash's own names, or the ones Vercel's Upstash integration sets.
  const url = e.UPSTASH_REDIS_REST_URL ?? e.KV_REST_API_URL;
  const token = e.UPSTASH_REDIS_REST_TOKEN ?? e.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function redisIncr({ url, token }: RedisConfig, key: string, windowMs: number): Promise<number> {
  // The key is unique to this window, so re-setting the expiry each hit is harmless.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs)],
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const [incr] = (await res.json()) as { result?: unknown; error?: string }[];
  if (typeof incr?.result !== "number") throw new Error(`Upstash INCR failed: ${incr?.error ?? "unexpected response"}`);
  return incr.result;
}

let lastRedisWarning = 0;
function warnRedisDown(err: unknown) {
  const now = Date.now();
  if (now - lastRedisWarning < 60_000) return; // one line a minute per instance, not one per request
  lastRedisWarning = now;
  logger.warn("rate_limit.redis_unavailable", { error: err });
}

// ── In-memory fallback (per instance) ──────────────────────────────────────

const store = new Map<string, { count: number; resetAt: number }>();
let lastSweep = Date.now();

function memoryIncr(key: string, resetAt: number, now: number): number {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    lastSweep = now;
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt });
    return 1;
  }
  return ++bucket.count;
}
