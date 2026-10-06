// Runs `prisma migrate deploy` safely during builds.
//
// 1. Uses a DIRECT database connection when available. Migrations take a
//    session-level advisory lock; through a pooler (PgBouncer / Neon "-pooler")
//    that lock gets stranded on a pooled server connection and blocks every
//    later deploy with P1002 "Timed out trying to acquire a postgres advisory lock".
// 2. Releases such a stranded lock first: a holder that is idle (not running a
//    migration) is terminated. A real in-flight migration is never idle for long.
// 3. Skips migrations on Vercel PREVIEW deploys (they share the production DB;
//    unreviewed branches must not change its schema). Set MIGRATE_ON_PREVIEW=true
//    to opt in, e.g. when previews use their own Neon branch database.
import { spawnSync } from "node:child_process";

const LOCK_ID = 72707369; // Prisma Migrate's advisory lock key

if (process.env.VERCEL_ENV === "preview" && process.env.MIGRATE_ON_PREVIEW !== "true") {
  console.log("[migrate] Preview deploy: skipping migrations (shared production database).");
  process.exit(0);
}

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;
if (direct) process.env.DATABASE_URL = direct;
else if (/-pooler\./.test(process.env.DATABASE_URL ?? "")) {
  console.warn("[migrate] DATABASE_URL is a pooled connection and no direct URL is set (DATABASE_URL_UNPOOLED).");
}

async function releaseStrandedLock() {
  let PrismaClient;
  try {
    ({ PrismaClient } = await import("@prisma/client"));
  } catch {
    return; // client not generated yet; nothing to do
  }
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT l.pid, a.state, a.application_name, pg_terminate_backend(l.pid) AS terminated
         FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory' AND l.objid = ${LOCK_ID} AND l.granted
          AND l.pid <> pg_backend_pid()
          AND a.state = 'idle' AND a.state_change < now() - interval '20 seconds'`,
    );
    for (const r of rows) console.log(`[migrate] Released stranded migration lock held by idle connection (pid ${r.pid}, ${r.application_name || "unknown"}).`);
  } catch (err) {
    console.warn("[migrate] Could not check for a stranded lock:", err?.message ?? err);
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

await releaseStrandedLock();

const run = () => spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
let r = run();
if (r.status !== 0) {
  // One retry after another sweep, in case a lock was stranded mid-build by a parallel deploy.
  console.log("[migrate] Retrying once after releasing any stranded lock…");
  await new Promise((res) => setTimeout(res, 25_000));
  await releaseStrandedLock();
  r = run();
}
process.exit(r.status ?? 1);
