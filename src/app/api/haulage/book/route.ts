import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { sendHaulageBookingLink } from "@/lib/mail";
import { bookingPath, bookingUrl, newBookingReference, startHaulagePayment } from "@/lib/haulage/payments";
import { verifyHaulageQuote } from "@/lib/haulage/service";
import { haulageBookSchema, type HaulageBookInput } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/haulage/book
 * Creates a truck booking from a signed quote, then starts the first payment
 * (full or deposit). Retry-safe via `idempotencyKey`, exactly like checkout.
 */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "haulage-book", 10);
  if (blocked) return blocked;
  const parsed = await parseJson(req, haulageBookSchema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;
  if (input.website) return apiError(400, "REJECTED", "Request rejected.");
  if (!env().PAYSTACK_SECRET_KEY) {
    return apiError(503, "PAYMENTS_UNAVAILABLE", "Online payment is temporarily unavailable. Please contact us to book a truck.", { retryable: false });
  }

  const requestHash = hash(input);
  let booking = await db.haulageRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });

  if (booking) {
    if (booking.requestHash !== requestHash) return apiError(422, "IDEMPOTENCY_KEY_REUSED", "Your booking changed. Please submit again.", { retryable: true });
  } else {
    const v = verifyHaulageQuote(input.quoteToken);
    if (!v.ok) {
      return apiError(409, "QUOTE_EXPIRED", v.reason === "expired" ? "Your price has expired. We've refreshed it — please check it and pay again." : "Please set your pickup and drop-off pins again.", { retryable: true });
    }
    const q = v.data;
    try {
      booking = await db.haulageRequest.create({
        data: {
          reference: newBookingReference(),
          idempotencyKey: input.idempotencyKey,
          requestHash,
          customerName: input.customer.fullName,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          companyName: input.customer.companyName || null,
          pickupAddress: input.pickupAddress,
          pickupLat: q.pickup.lat,
          pickupLng: q.pickup.lng,
          pickupState: q.pickup.state,
          dropoffAddress: input.dropoffAddress,
          dropoffLat: q.dropoff.lat,
          dropoffLng: q.dropoff.lng,
          dropoffState: q.dropoff.state,
          containerSize: q.size,
          containerCount: q.count,
          containerNumbers: input.containerNumbers || null,
          preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
          notes: input.notes || null,
          distanceKm: q.distanceKm,
          priceMethod: q.method,
          perContainerKobo: q.perContainerKobo,
          totalKobo: q.totalKobo,
          depositPct: q.depositPct,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        booking = await db.haulageRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (!booking) return apiError(409, "RETRY", "Please try again.", { retryable: true });
      } else throw err;
    }
    logger.info("haulage.booking_created", { reference: booking.reference, totalKobo: booking.totalKobo });
    const b = booking;
    // The customer gets their private link even if the payment window never opens.
    after(() => sendHaulageBookingLink(b, bookingUrl(b)).catch((err) => logger.warn("mail.haulage_link_failed", { reference: b.reference, error: err })));
  }

  // One payment attempt per booking attempt; the derived key keeps retries on the same payment.
  const started = await startHaulagePayment(booking.id, input.plan, `${input.idempotencyKey}:first`);
  const path = bookingPath(booking);
  if (!started.ok) return apiError(started.status, started.code, started.message, { retryable: started.retryable, fields: { bookingPath: path } });
  return ok({ booking: { reference: booking.reference, path }, payment: started.payment }, 201);
}

function hash(input: HaulageBookInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, website, ...rest } = input;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}
