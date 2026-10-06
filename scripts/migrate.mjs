// Runs `prisma migrate deploy` over a DIRECT database connection.
// Migrations take a session-level advisory lock; through a connection pooler
// (PgBouncer / Neon "-pooler" host) that lock can be stranded and block every
// later deploy. Vercel's Neon integration exposes the direct URL as
// DATABASE_URL_UNPOOLED, so prefer it (or DIRECT_URL) when present.
import { spawnSync } from "node:child_process";

const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;
const env = { ...process.env, ...(direct ? { DATABASE_URL: direct } : {}) };
if (!direct && /-pooler\./.test(process.env.DATABASE_URL ?? "")) {
  console.warn("[migrate] DATABASE_URL points at a pooler and no direct URL is set; migrations may hang.");
}
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
