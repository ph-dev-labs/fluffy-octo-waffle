import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment sanity check. Reports WHICH setting is broken
 * (names only, never values) so misconfigured deploys are quick to diagnose.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const e = env();
    checks.env = { ok: true };
    checks.paystack = e.PAYSTACK_SECRET_KEY ? { ok: true, detail: e.PAYSTACK_SECRET_KEY.startsWith("sk_live_") ? "live" : "test" } : { ok: false, detail: "PAYSTACK_SECRET_KEY not set" };
    checks.cron = e.CRON_SECRET ? { ok: true } : { ok: false, detail: "CRON_SECRET not set" };
  } catch (err) {
    // env() lists the invalid variable NAMES and rules — no secret values.
    checks.env = { ok: false, detail: (err as Error).message };
  }

  try {
    const containers = await db.container.count();
    checks.database = { ok: true, detail: `${containers} containers` };
  } catch (err) {
    const msg = (err as Error).message;
    checks.database = {
      ok: false,
      detail: /must start with the protocol `postgres/.test(msg)
        ? "DATABASE_URL must be a postgresql:// connection string"
        : /does not exist|no such table/i.test(msg)
          ? "Database reachable but tables missing — run prisma db push / migrate deploy"
          : /Environment variable not found: DATABASE_URL/.test(msg)
            ? "DATABASE_URL not set"
            : "Database connection failed (check Vercel function logs)",
    };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
