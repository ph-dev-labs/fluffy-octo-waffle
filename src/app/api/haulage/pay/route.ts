import type { NextRequest } from "next/server";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { findBookingByLink, startHaulagePayment } from "@/lib/haulage/payments";
import { haulagePaySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** POST /api/haulage/pay — next instalment (deposit/full before anything is paid, otherwise the balance). */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "haulage-pay", 10);
  if (blocked) return blocked;
  const parsed = await parseJson(req, haulagePaySchema);
  if ("error" in parsed) return parsed.error;
  const { reference, key, plan, idempotencyKey } = parsed.data;

  const booking = await findBookingByLink(reference, key);
  if (!booking) return apiError(404, "NOT_FOUND", "We couldn't find that booking. Use the link from your email.");
  const started = await startHaulagePayment(booking.id, plan, idempotencyKey);
  if (!started.ok) return apiError(started.status, started.code, started.message, { retryable: started.retryable });
  return ok({ payment: started.payment });
}
