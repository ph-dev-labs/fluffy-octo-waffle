import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/http";
import { logger } from "@/lib/logger";
import { isValidWebhookSignature, PaymentsNotConfiguredError } from "@/lib/paystack";
import { syncOrder } from "@/lib/payments";
import { referenceSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED = new Set(["charge.success", "charge.failed", "refund.processed"]);

/**
 * POST /api/payments/webhook — configure this URL in the Paystack dashboard.
 *
 * 1. Verify the HMAC signature over the RAW body (constant-time compare).
 * 2. Optionally enforce Paystack's IP allowlist.
 * 3. Dedupe by event key so replays are no-ops.
 * 4. Never trust the payload's amount/status: re-verify via the API, then apply.
 * 5. Return 5xx on processing errors so Paystack retries (it retries for 72h).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 256 * 1024) return new NextResponse(null, { status: 413 });

  const allowedIps = env().PAYSTACK_WEBHOOK_IPS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowedIps?.length && !allowedIps.includes(clientIp(req))) {
    logger.warn("webhook.ip_rejected", { ip: clientIp(req) });
    return new NextResponse(null, { status: 401 });
  }

  let valid = false;
  try {
    valid = isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"));
  } catch (err) {
    if (err instanceof PaymentsNotConfiguredError) return new NextResponse(null, { status: 503 });
    throw err;
  }
  if (!valid) {
    logger.warn("webhook.bad_signature", { ip: clientIp(req) });
    return new NextResponse(null, { status: 401 });
  }

  let event: { event?: string; data?: { id?: number; reference?: string; transaction_reference?: string; status?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const type = event.event ?? "unknown";
  // refund events carry the original charge reference in `transaction_reference`
  const reference = event.data?.transaction_reference ?? event.data?.reference ?? null;
  const eventKey = `${type}:${event.data?.id ?? createHash("sha256").update(raw).digest("hex")}`;

  if (await db.paymentEvent.findUnique({ where: { eventKey } })) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (HANDLED.has(type) && reference && referenceSchema.safeParse(reference).success) {
      if (type === "refund.processed") {
        await db.order.updateMany({
          where: { reference, status: "PAID" },
          data: { status: "REFUNDED", needsReview: true, reviewNote: "Refund processed by Paystack." },
        });
      } else {
        const order = await syncOrder(reference, `webhook:${type}`);
        if (!order) logger.warn("webhook.unknown_reference", { reference, type });
      }
    }

    // Record AFTER successful processing; processing itself is idempotent, so
    // a crash between the two just means the next retry re-applies safely.
    await db.paymentEvent
      .create({ data: { eventKey, type, reference, payload: raw } })
      .catch((err) => logger.warn("webhook.event_record_failed", { eventKey, error: err }));

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("webhook.processing_failed", { type, reference, error: err });
    return new NextResponse(null, { status: 500 }); // Paystack will retry
  }
}
