import "server-only";
import { randomBytes } from "node:crypto";
import type { HaulagePayment, HaulageRequest, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notifyHaulagePaid } from "@/lib/mail";
import { canTransition, decide, FINAL_STATUSES, type OrderStatus } from "@/lib/payment-rules";
import { initializeTransaction, PaymentsNotConfiguredError, PaystackError, verifyTransaction, type PaystackTransaction } from "@/lib/paystack";
import { maskEmail } from "@/lib/utils";
import { nextPayment, outstandingKobo, paymentState, type PaymentPlan } from "./calc";
import { getHaulageConfig } from "./service";
import { bookingPath } from "./link";

export { bookingPath, bookingUrl, findBookingByLink } from "./link";

// Same guarantees as container orders (lib/payments.ts): every instalment is
// its own Paystack transaction; webhook, status poll and the reconcile cron
// may all apply a result concurrently and only one write ever wins.

export type HaulageWithPayments = HaulageRequest & { payments: HaulagePayment[] };

export const HAULAGE_REF_PREFIX = "CZ_HL_";
export const isHaulageReference = (ref: string) => ref.startsWith(HAULAGE_REF_PREFIX);

export function newHaulagePaymentReference() {
  return `${HAULAGE_REF_PREFIX}${Date.now().toString(36).toUpperCase()}_${randomBytes(6).toString("hex").toUpperCase()}`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function newBookingReference() {
  const bytes = randomBytes(7);
  return `HL-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

// ── Starting a payment ─────────────────────────────────────────────────────

export interface StartedPayment {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
  amountKobo: number;
  kind: string;
}

export type StartResult =
  | { ok: true; payment: StartedPayment }
  | { ok: false; status: number; code: string; message: string; retryable?: boolean };

/**
 * Creates (or resumes) the next instalment for a booking and initialises it at
 * Paystack. Retry-safe: the same idempotency key always returns the same
 * payment, and an unpaid attempt for the same amount is reused instead of
 * opening a second one (so a customer can't accidentally pay twice).
 */
export async function startHaulagePayment(requestId: string, plan: PaymentPlan, idempotencyKey: string): Promise<StartResult> {
  const replay = await db.haulagePayment.findUnique({ where: { idempotencyKey } });
  if (replay) {
    if (replay.requestId !== requestId) return { ok: false, status: 422, code: "IDEMPOTENCY_KEY_REUSED", message: "Please try again.", retryable: true };
    if (replay.status === "PENDING" && replay.paystackAccessCode) return { ok: true, payment: view(replay) };
    if (replay.status === "PAID") return { ok: false, status: 409, code: "ALREADY_PAID", message: "That payment has already gone through." };
    if (replay.status !== "PENDING") return { ok: false, status: 409, code: "ORDER_CLOSED", message: "That payment attempt has ended. Please try again.", retryable: true };
    return initialize(replay);
  }

  const request = await db.haulageRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, status: 404, code: "NOT_FOUND", message: "Booking not found." };
  if (request.status === "CANCELLED") return { ok: false, status: 409, code: "CANCELLED", message: "This booking was cancelled. Contact us if you think that's a mistake." };

  const cfg = await getHaulageConfig();
  const next = nextPayment({ plan, totalKobo: request.totalKobo, paidKobo: request.paidKobo, depositPct: request.depositPct, allowDeposit: cfg.allowDeposit });
  if (!next.ok) return { ok: false, status: 409, code: "NOTHING_DUE", message: next.reason };

  // An open attempt for exactly this amount? Hand that one back.
  const open = await db.haulagePayment.findFirst({
    where: { requestId, status: "PENDING", amountKobo: next.amountKobo, paystackAccessCode: { not: null }, createdAt: { gt: new Date(Date.now() - 12 * 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (open) return { ok: true, payment: view(open) };

  let payment: HaulagePayment;
  try {
    payment = await db.haulagePayment.create({
      data: { requestId, kind: next.kind, amountKobo: next.amountKobo, currency: request.currency, reference: newHaulagePaymentReference(), idempotencyKey },
    });
  } catch (err) {
    if ((err as Prisma.PrismaClientKnownRequestError).code === "P2002") return startHaulagePayment(requestId, plan, idempotencyKey);
    throw err;
  }
  logger.info("haulage.payment_created", { booking: request.reference, reference: payment.reference, kind: next.kind, amountKobo: next.amountKobo });
  return initialize(payment);
}

async function initialize(payment: HaulagePayment): Promise<StartResult> {
  const request = await db.haulageRequest.findUniqueOrThrow({ where: { id: payment.requestId } });
  const callback = `${env().APP_URL}${bookingPath(request)}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // A retry gets a fresh reference: the previous one may exist at Paystack (timeout).
      payment = await db.haulagePayment.update({
        where: { id: payment.id },
        data: { initAttempts: { increment: 1 }, ...(payment.initAttempts > 0 ? { reference: newHaulagePaymentReference() } : {}) },
      });
      const res = await initializeTransaction({
        email: request.customerEmail,
        amountKobo: payment.amountKobo,
        currency: payment.currency,
        reference: payment.reference,
        callbackUrl: callback,
        metadata: {
          haulage_booking: request.reference,
          payment_kind: payment.kind,
          cancel_action: callback,
          custom_fields: [
            { display_name: "Truck booking", variable_name: "booking", value: request.reference },
            { display_name: "Payment", variable_name: "kind", value: payment.kind.toLowerCase() },
          ],
        },
      });
      payment = await db.haulagePayment.update({ where: { id: payment.id }, data: { paystackAccessCode: res.access_code, paystackAuthUrl: res.authorization_url } });
      return { ok: true, payment: view(payment) };
    } catch (err) {
      lastError = err;
      if (err instanceof PaymentsNotConfiguredError) break;
      if (err instanceof PaystackError && !err.retryable && !/duplicate/i.test(err.message)) break;
    }
  }
  logger.error("haulage.initialize_failed", { reference: payment.reference, error: lastError });
  const retryable = !(lastError instanceof PaystackError) || lastError.retryable;
  return {
    ok: false,
    status: retryable ? 503 : 502,
    code: "PAYMENT_INIT_FAILED",
    message: retryable ? "We couldn't reach our payment provider. You have NOT been charged — please try again." : "Our payment provider declined to start this payment. You have NOT been charged.",
    retryable,
  };
}

const view = (p: HaulagePayment): StartedPayment => ({ reference: p.reference, accessCode: p.paystackAccessCode!, authorizationUrl: p.paystackAuthUrl!, amountKobo: p.amountKobo, kind: p.kind });

// ── Applying Paystack results ──────────────────────────────────────────────

/** Σ PAID instalments → booking.paidKobo, and confirm / flag the booking. */
async function recomputeBooking(trx: Prisma.TransactionClient, requestId: string) {
  // Row lock: two instalments confirmed at once are summed one after the other,
  // so the second sees the first and paidKobo can never be under-counted.
  await trx.$queryRaw`SELECT 1 FROM "HaulageRequest" WHERE "id" = ${requestId} FOR UPDATE`;
  const sum = await trx.haulagePayment.aggregate({ where: { requestId, status: "PAID" }, _sum: { amountKobo: true } });
  const paid = sum._sum.amountKobo ?? 0;
  const r = await trx.haulageRequest.findUniqueOrThrow({ where: { id: requestId } });
  const state = paymentState(r.totalKobo, paid);
  await trx.haulageRequest.update({
    where: { id: requestId },
    data: {
      paidKobo: paid,
      ...(paid > 0 && r.status === "AWAITING_PAYMENT" ? { status: "CONFIRMED" } : {}),
      ...(state === "OVERPAID" ? { needsReview: true, reviewNote: `Overpaid by ₦${((paid - r.totalKobo) / 100).toLocaleString("en-NG")} — refund the difference in Paystack.` } : {}),
    },
  });
  if (state === "OVERPAID") logger.error("haulage.overpaid", { booking: r.reference, paid, total: r.totalKobo });
}

export async function applyHaulageTransaction(payment: HaulagePayment, tx: PaystackTransaction, source: string): Promise<HaulagePayment> {
  const current = payment.status as OrderStatus;
  const decision = decide(current, { reference: payment.reference, amountKobo: payment.amountKobo, currency: payment.currency }, tx);
  const meta = { paystackTransactionId: String(tx.id), channel: tx.channel, gatewayResponse: tx.gateway_response?.slice(0, 250) ?? null };

  await db.$transaction(async (trx) => {
    await trx.haulagePayment.update({ where: { id: payment.id }, data: { verifyAttempts: { increment: 1 }, lastVerifiedAt: new Date() } });

    if (decision.next === "REVIEW_REVERSAL") {
      await trx.haulagePayment.update({ where: { id: payment.id }, data: { needsReview: true, reviewNote: decision.note } });
      await trx.haulageRequest.update({ where: { id: payment.requestId }, data: { needsReview: true, reviewNote: `Payment ${payment.reference}: ${decision.note}` } });
      logger.error("haulage.reversed_after_paid", { reference: payment.reference, source });
      return;
    }
    if (!canTransition(current, decision.next)) return;

    if (decision.next === "PAID") {
      const won = await trx.haulagePayment.updateMany({
        where: { id: payment.id, status: { notIn: [...FINAL_STATUSES] } },
        data: { status: "PAID", paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date(), ...meta },
      });
      if (won.count !== 1) return;
      await recomputeBooking(trx, payment.requestId);
      logger.info("haulage.paid", { reference: payment.reference, amountKobo: payment.amountKobo, source });
      return;
    }

    if (decision.next === "AMOUNT_MISMATCH") {
      const won = await trx.haulagePayment.updateMany({
        where: { id: payment.id, status: { notIn: [...FINAL_STATUSES] } },
        data: { status: "AMOUNT_MISMATCH", needsReview: true, reviewNote: decision.note, ...meta },
      });
      if (won.count === 1) {
        await trx.haulageRequest.update({ where: { id: payment.requestId }, data: { needsReview: true, reviewNote: `Payment ${payment.reference}: ${decision.note}` } });
        logger.error("haulage.amount_mismatch", { reference: payment.reference, note: decision.note, source });
      }
      return;
    }

    await trx.haulagePayment.updateMany({ where: { id: payment.id, status: { notIn: [...FINAL_STATUSES] } }, data: { status: decision.next, ...meta } });
  });

  const fresh = await db.haulagePayment.findUniqueOrThrow({ where: { id: payment.id } });
  if (fresh.status === "PAID" && !fresh.receiptSentAt) {
    await notifyHaulagePaid(fresh.id).catch((err) => logger.error("mail.haulage_receipt_failed", { reference: fresh.reference, error: err }));
  }
  return fresh;
}

/** Re-checks one instalment with Paystack (the source of truth). */
export async function syncHaulagePayment(reference: string, source: string): Promise<HaulagePayment | null> {
  const p = await db.haulagePayment.findUnique({ where: { reference } });
  if (!p) return null;
  if (FINAL_STATUSES.has(p.status as OrderStatus) || !p.paystackAccessCode) return p;
  const result = await verifyTransaction(reference);
  if (!result.found) {
    return db.haulagePayment.update({ where: { id: p.id }, data: { verifyAttempts: { increment: 1 }, lastVerifiedAt: new Date() } });
  }
  return applyHaulageTransaction(p, result.transaction, source);
}

/** Paystack refund webhook for an instalment. */
export async function markHaulageRefunded(reference: string) {
  await db.$transaction(async (trx) => {
    const p = await trx.haulagePayment.findUnique({ where: { reference } });
    if (!p) return;
    const won = await trx.haulagePayment.updateMany({ where: { id: p.id, status: "PAID" }, data: { status: "REFUNDED", needsReview: true, reviewNote: "Refund processed by Paystack." } });
    if (won.count === 1) {
      await recomputeBooking(trx, p.requestId);
      await trx.haulageRequest.update({ where: { id: p.requestId }, data: { needsReview: true, reviewNote: `Payment ${reference} was refunded.` } });
    }
  });
}

// ── Customer-facing view ───────────────────────────────────────────────────

export function publicHaulage(r: HaulageWithPayments) {
  return {
    reference: r.reference,
    status: r.status,
    customerName: r.customerName,
    email: maskEmail(r.customerEmail),
    pickupAddress: r.pickupAddress,
    pickupState: r.pickupState,
    dropoffAddress: r.dropoffAddress,
    dropoffState: r.dropoffState,
    containerSize: r.containerSize,
    containerCount: r.containerCount,
    preferredDate: r.preferredDate?.toISOString() ?? null,
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    distanceKm: r.distanceKm,
    totalKobo: r.totalKobo,
    paidKobo: r.paidKobo,
    outstandingKobo: outstandingKobo(r.totalKobo, r.paidKobo),
    paymentState: paymentState(r.totalKobo, r.paidKobo),
    depositPct: r.depositPct,
    driver: r.status === "SCHEDULED" || r.status === "IN_TRANSIT" ? { name: r.driverName, phone: r.driverPhone, truck: r.truckPlate } : null,
    payments: r.payments.map((p) => ({ reference: p.reference, kind: p.kind, amountKobo: p.amountKobo, status: p.status, paidAt: p.paidAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString() })),
    createdAt: r.createdAt.toISOString(),
  };
}

export type PublicHaulage = ReturnType<typeof publicHaulage>;
