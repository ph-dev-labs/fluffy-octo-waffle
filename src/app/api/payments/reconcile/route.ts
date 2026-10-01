import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { syncOrder } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Reconciliation sweep — the safety net that guarantees no paid order is left
 * unconfirmed even if the customer's network died AND the webhook was lost.
 *
 * Run every 5–10 minutes from a scheduler (vercel.json cron, GitHub Actions,
 * cron-job.org...) with `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });

  const provided = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const candidates = await db.order.findMany({
    where: {
      status: { in: ["PENDING", "FAILED", "ABANDONED"] },
      paystackAccessCode: { not: null },
      createdAt: { lt: new Date(now - 2 * MINUTE), gt: new Date(now - 72 * HOUR) },
      OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: new Date(now - 5 * MINUTE) } }],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { reference: true },
  });

  const summary = { checked: 0, paid: 0, failed: 0, errors: 0, abandoned: 0 };

  for (const { reference } of candidates) {
    try {
      const order = await syncOrder(reference, "reconcile");
      summary.checked++;
      if (order?.status === "PAID") summary.paid++;
      if (order?.status === "FAILED") summary.failed++;
    } catch (err) {
      summary.errors++;
      logger.warn("reconcile.order_failed", { reference, error: err });
    }
  }

  // Stale pending orders (> 24h, still unpaid after verification) are marked
  // ABANDONED for reporting. They stay re-checkable — ABANDONED is not final.
  const stale = await db.order.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now - 24 * HOUR) } },
    data: { status: "ABANDONED" },
  });
  summary.abandoned = stale.count;

  logger.info("reconcile.done", summary);
  return NextResponse.json(summary);
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle;
