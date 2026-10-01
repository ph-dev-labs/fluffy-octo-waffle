import type { NextRequest } from "next/server";
import { apiError, clientIp, ok } from "@/lib/http";
import { logger } from "@/lib/logger";
import { PaymentsNotConfiguredError, PaystackError } from "@/lib/paystack";
import { publicOrder, syncOrder } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { referenceSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * GET /api/payments/verify?reference=CZ_...
 *
 * Polled by the status page. Asks Paystack (never the browser) whether the
 * payment succeeded and updates the order idempotently. The reference itself
 * is unguessable, and the response contains no personal data beyond a masked email.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(`verify:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return apiError(429, "RATE_LIMITED", "Checking too often, slowing down…", { retryable: true });

  const parsed = referenceSchema.safeParse(req.nextUrl.searchParams.get("reference"));
  if (!parsed.success) return apiError(400, "INVALID_REFERENCE", "That payment reference is not valid.");

  try {
    const order = await syncOrder(parsed.data, "status_poll");
    if (!order) return apiError(404, "NOT_FOUND", "We couldn't find a payment with that reference.");
    return ok({ order: publicOrder(order) });
  } catch (err) {
    if (err instanceof PaymentsNotConfiguredError) return apiError(503, "PAYMENTS_UNAVAILABLE", "Payment verification is unavailable.", { retryable: true });
    const retryable = !(err instanceof PaystackError) || err.retryable;
    logger.error("verify.failed", { reference: parsed.data, error: err });
    return apiError(503, "VERIFY_UNAVAILABLE", "We couldn't confirm your payment yet. It is safe — we'll keep checking.", { retryable });
  }
}
