import { afterEach, before, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused";
process.env.APP_URL ??= "http://localhost:3000";
process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io/";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

let rateLimit: typeof import("../src/lib/rate-limit").rateLimit;

// Imported after env is set (env() is parsed lazily but cached on first use).
before(async () => {
  ({ rateLimit } = await import("../src/lib/rate-limit"));
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A fake Upstash: one shared counter map, like Redis seen from many instances. */
function fakeUpstash() {
  const counts = new Map<string, number>();
  const calls: { url: string; auth: string | null; body: string[][] }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as string[][];
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization"), body });
    const key = body[0]![1]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return Response.json([{ result: counts.get(key) }, { result: 1 }]);
  }) as typeof fetch;
  return { counts, calls };
}

test("counts in Redis and blocks once the limit is passed", async () => {
  const { calls } = fakeUpstash();
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await rateLimit("checkout:1.2.3.4", 3, 60_000));

  assert.deepEqual(results.map((r) => r.ok), [true, true, true, false]);
  assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0, 0]);
  assert.ok(results[3]!.retryAfterSec > 0 && results[3]!.retryAfterSec <= 60);

  assert.equal(calls[0]!.url, "https://fake-redis.upstash.io/pipeline");
  assert.equal(calls[0]!.auth, "Bearer test-token");
  assert.equal(calls[0]!.body[0]![0], "INCR");
  assert.match(calls[0]!.body[0]![1]!, /^rl:checkout:1\.2\.3\.4:\d+$/);
  assert.deepEqual(calls[0]!.body[1], ["PEXPIRE", calls[0]!.body[0]![1], "60000"]);
});

test("different keys are limited independently", async () => {
  fakeUpstash();
  for (let i = 0; i < 2; i++) await rateLimit("contact:a", 2, 60_000);
  assert.equal((await rateLimit("contact:a", 2, 60_000)).ok, false);
  assert.equal((await rateLimit("contact:b", 2, 60_000)).ok, true);
});

test("falls back to in-memory limiting when Redis is unreachable", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const results = [];
  for (let i = 0; i < 3; i++) results.push((await rateLimit("login:down", 2, 60_000)).ok);
  assert.deepEqual(results, [true, true, false]);
});

test("falls back when Redis returns an error instead of a count", async () => {
  globalThis.fetch = (async () => Response.json([{ error: "ERR max requests limit exceeded" }])) as typeof fetch;
  assert.equal((await rateLimit("login:err", 1, 60_000)).ok, true);
  assert.equal((await rateLimit("login:err", 1, 60_000)).ok, false);
});
