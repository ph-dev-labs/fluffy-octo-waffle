import "server-only";
import { randomBytes } from "node:crypto";
import type { Order, OrderItem, Prisma } from "@prisma/client";
import { db } from "./db";
import { logger } from "./logger";
import { verifyTransaction, type PaystackTransaction } from "./paystack";
import { canTransition, decide, FINAL_STATUSES, type OrderStatus } from "./payment-rules";
import { maskEmail } from "./utils";
import { notifyOrderPaid } from "./mail";

export type OrderWithItems = Order & { items: OrderItem[] };

export function newReference(): string {
  return `CZ_${Date.now().toString(36).toUpperCase()}_${randomBytes(6).toString("hex").toUpperCase()}`;
}

/**
 * Applies a verified Paystack transaction to an order. Safe to call any number
 * of times, concurrently, from the webhook, the status poller and the cron:
 * every write is a conditional `updateMany` on the current status, so only one
 * caller ever wins a transition and stock is decremented exactly once.
 */
export async function applyTransaction(order: OrderWithItems, tx: PaystackTransaction, source: string): Promise<OrderWithItems> {
  const current = order.status as OrderStatus;
  const decision = decide(current, { reference: order.reference, amountKobo: order.amountKobo, currency: order.currency }, tx);
  const meta = {
    paystackTransactionId: String(tx.id),
    channel: tx.channel,
    gatewayResponse: tx.gateway_response?.slice(0, 250) ?? null,
  };

  await db.$transaction(async (trx) => {
    await trx.order.update({
      where: { id: order.id },
      data: { verifyAttempts: { increment: 1 }, lastVerifiedAt: new Date() },
    });

    if (decision.next === "REVIEW_REVERSAL") {
      await trx.order.update({ where: { id: order.id }, data: { needsReview: true, reviewNote: decision.note } });
      logger.error("payment.reversed_after_paid", { reference: order.reference, source });
      return;
    }

    if (!canTransition(current, decision.next)) return;

    if (decision.next === "PAID") {
      const won = await trx.order.updateMany({
        where: { id: order.id, status: { notIn: [...FINAL_STATUSES] } },
        data: { status: "PAID", paidAt: tx.paid_at ? new Date(tx.paid_at) : new Date(), ...meta },
      });
      if (won.count !== 1) return; // someone else already finalised it

      await decrementStock(trx, order);
      logger.info("payment.paid", { reference: order.reference, amountKobo: order.amountKobo, source });
      return;
    }

    if (decision.next === "AMOUNT_MISMATCH") {
      const won = await trx.order.updateMany({
        where: { id: order.id, status: { notIn: [...FINAL_STATUSES] } },
        data: { status: "AMOUNT_MISMATCH", needsReview: true, reviewNote: decision.note, ...meta },
      });
      if (won.count === 1) logger.error("payment.amount_mismatch", { reference: order.reference, note: decision.note, source });
      return;
    }

    // FAILED or back to PENDING (e.g. customer retried after a failed card).
    await trx.order.updateMany({
      where: { id: order.id, status: { notIn: [...FINAL_STATUSES] } },
      data: { status: decision.next, ...meta },
    });
    logger.info("payment.status_changed", { reference: order.reference, from: current, to: decision.next, source });
  });

  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  if (fresh.status === "PAID" && !fresh.receiptSentAt) {
    // Email must never break payment processing; notifyOrderPaid is idempotent.
    await notifyOrderPaid(fresh.id).catch((err) => logger.error("mail.receipt_failed", { reference: fresh.reference, error: err }));
  }
  return fresh;
}

async function decrementStock(trx: Prisma.TransactionClient, order: OrderWithItems) {
  const conflicts: string[] = [];
  for (const item of order.items) {
    const res = await trx.container.updateMany({
      where: { id: item.containerId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (res.count === 0) conflicts.push(item.title);
  }
  if (conflicts.length) {
    // Customer has paid — never fail the order. Flag it so ops can source stock or refund.
    await trx.order.update({
      where: { id: order.id },
      data: { needsReview: true, reviewNote: `Insufficient stock at payment time: ${conflicts.join(", ")}` },
    });
    logger.error("payment.stock_conflict", { reference: order.reference, items: conflicts });
  }
}

/**
 * Re-checks an order against Paystack (the source of truth) and applies the
 * result. Returns the up-to-date order. Never trusts anything the browser says.
 */
export async function syncOrder(reference: string, source: string): Promise<OrderWithItems | null> {
  const order = await db.order.findUnique({ where: { reference }, include: { items: true } });
  if (!order) return null;
  if (FINAL_STATUSES.has(order.status as OrderStatus)) return order;
  if (!order.paystackAccessCode) return order; // never reached Paystack, nothing to verify

  const result = await verifyTransaction(reference);
  if (!result.found) {
    await db.order.update({ where: { id: order.id }, data: { verifyAttempts: { increment: 1 }, lastVerifiedAt: new Date() } });
    return db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
  }
  return applyTransaction(order, result.transaction, source);
}

/** Safe, non-PII view of an order for the public status endpoint. */
export function publicOrder(order: OrderWithItems) {
  return {
    reference: order.reference,
    status: order.status as OrderStatus,
    amountKobo: order.amountKobo,
    subtotalKobo: order.subtotalKobo,
    deliveryKobo: order.deliveryKobo,
    currency: order.currency,
    email: maskEmail(order.customerEmail),
    fulfilment: order.fulfilment,
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPriceKobo: i.unitPriceKobo })),
  };
}

export type PublicOrder = ReturnType<typeof publicOrder>;
