import type { NextRequest } from "next/server";
import { apiError, clientIp, ok } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { findBookingByLink, isHaulageReference, publicHaulage, syncHaulagePayment } from "@/lib/haulage/payments";
import { haulageLinkSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * GET /api/haulage/status?reference=HL-…&k=…[&payment=CZ_HL_…]
 * Booking view for its private link. With `payment`, first re-checks that
 * instalment with Paystack (used right after the payment window closes).
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(`haulage-status:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return apiError(429, "RATE_LIMITED", "Checking too often, slowing down…", { retryable: true });
  const sp = req.nextUrl.searchParams;
  const link = haulageLinkSchema.safeParse({ reference: sp.get("reference"), key: sp.get("k") });
  if (!link.success) return apiError(400, "INVALID_LINK", "That booking link is not valid.");

  let booking = await findBookingByLink(link.data.reference, link.data.key);
  if (!booking) return apiError(404, "NOT_FOUND", "We couldn't find that booking.");

  const payment = sp.get("payment");
  if (payment && isHaulageReference(payment) && booking.payments.some((p) => p.reference === payment)) {
    try {
      await syncHaulagePayment(payment, "status_poll");
      booking = (await findBookingByLink(link.data.reference, link.data.key))!;
    } catch (err) {
      logger.warn("haulage.status_sync_failed", { payment, error: err });
      // Still return the booking; the cron keeps checking. Money is never lost.
    }
  }
  return ok({ booking: publicHaulage(booking) });
}
