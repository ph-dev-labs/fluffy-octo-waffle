import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { initializeTransaction, PaymentsNotConfiguredError, PaystackError } from "@/lib/paystack";
import { newReference, type OrderWithItems } from "@/lib/payments";
import { CURRENCY, deliveryFeeKobo, MAX_ORDER_KOBO } from "@/lib/pricing";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /api/checkout
 *
 * Creates (or resumes) an order and a Paystack transaction for it.
 *
 * Retry safety: the browser sends an `idempotencyKey` (UUID) that stays the
 * same for one checkout attempt. If the network drops after we created the
 * order, the browser simply retries with the same key and gets the SAME order
 * and access code back — it can never create a second charge.
 */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "checkout", 10);
  if (blocked) return blocked;

  const parsed = await parseJson(req, checkoutSchema);
  if ("error" in parsed) return parsed.error;
  const input = parsed.data;

  if (input.website) return apiError(400, "REJECTED", "Request rejected.");
  if (!env().PAYSTACK_SECRET_KEY) {
    logger.error("checkout.not_configured");
    return apiError(503, "PAYMENTS_UNAVAILABLE", "Online payment is temporarily unavailable. Please contact us to complete your order.", { retryable: false });
  }

  const requestHash = hashRequest(input);

  // ── 1. Idempotent replay ────────────────────────────────────────────────
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
  if (existing) return resume(existing, requestHash);

  // ── 2. Price everything server-side ────────────────────────────────────
  const quantities = new Map<string, number>();
  for (const line of input.items) quantities.set(line.containerId, (quantities.get(line.containerId) ?? 0) + line.quantity);

  const containers = await db.container.findMany({ where: { id: { in: [...quantities.keys()] }, active: true } });
  if (containers.length !== quantities.size) {
    return apiError(409, "ITEMS_UNAVAILABLE", "Some items in your cart are no longer available. Please review your cart.");
  }
  const outOfStock = containers.filter((c) => c.stock < quantities.get(c.id)!);
  if (outOfStock.length) {
    return apiError(409, "INSUFFICIENT_STOCK", `Not enough stock for: ${outOfStock.map((c) => c.title).join(", ")}.`);
  }

  const containerCount = [...quantities.values()].reduce((a, b) => a + b, 0);
  const subtotalKobo = containers.reduce((sum, c) => sum + c.priceKobo * quantities.get(c.id)!, 0);
  const deliveryKobo = input.fulfilment === "DELIVERY" ? deliveryFeeKobo(input.deliveryZone, containerCount) : 0;
  const amountKobo = subtotalKobo + deliveryKobo;

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0 || amountKobo > MAX_ORDER_KOBO) {
    return apiError(422, "INVALID_AMOUNT", "This order total can't be processed online. Please request a quote instead.");
  }

  // ── 3. Persist the order BEFORE talking to Paystack ─────────────────────
  let order: OrderWithItems;
  try {
    order = await db.order.create({
      data: {
        reference: newReference(),
        idempotencyKey: input.idempotencyKey,
        requestHash,
        currency: CURRENCY,
        subtotalKobo,
        deliveryKobo,
        amountKobo,
        customerName: input.customer.fullName,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
        companyName: input.customer.companyName || null,
        fulfilment: input.fulfilment,
        deliveryZone: input.fulfilment === "DELIVERY" ? input.deliveryZone : null,
        deliveryAddress: input.fulfilment === "DELIVERY" ? input.deliveryAddress || null : null,
        items: {
          create: containers.map((c) => ({
            containerId: c.id,
            title: c.title,
            unitPriceKobo: c.priceKobo,
            quantity: quantities.get(c.id)!,
          })),
        },
      },
      include: { items: true },
    });
  } catch (err) {
    // Two concurrent requests with the same key: the loser replays the winner.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
      if (winner) return resume(winner, requestHash);
    }
    throw err;
  }

  logger.info("checkout.order_created", { reference: order.reference, amountKobo });
  return initialize(order);
}

async function resume(order: OrderWithItems, requestHash: string) {
  if (order.requestHash !== requestHash) {
    return apiError(422, "IDEMPOTENCY_KEY_REUSED", "Your cart changed. Please submit again.", { retryable: true });
  }
  if (order.status === "PAID") {
    return apiError(409, "ALREADY_PAID", "This order has already been paid.", { fields: { reference: order.reference } });
  }
  if (order.paystackAccessCode && order.paystackAuthUrl && order.status === "PENDING") {
    return ok(checkoutResponse(order));
  }
  if (order.status !== "PENDING") {
    // FAILED / ABANDONED / mismatch: the client must start a fresh attempt.
    return apiError(409, "ORDER_CLOSED", "That payment attempt has ended. Please try again.", { retryable: true });
  }
  return initialize(order);
}

/**
 * Initialises a Paystack transaction. On a timeout we can't know whether
 * Paystack created it, so each attempt uses a NEW reference. Only the
 * reference whose access code we return can ever be paid, so this is safe.
 */
async function initialize(order: OrderWithItems) {
  const base = env().APP_URL;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // First ever attempt keeps the reference created with the order; any
      // later attempt rotates it because the previous one may exist at Paystack.
      order = await db.order.update({
        where: { id: order.id },
        data: { initAttempts: { increment: 1 }, ...(order.initAttempts > 0 ? { reference: newReference() } : {}) },
        include: { items: true },
      });
      const reference = order.reference;
      const result = await initializeTransaction({
        email: order.customerEmail,
        amountKobo: order.amountKobo,
        currency: order.currency,
        reference,
        callbackUrl: `${base}/checkout/status`,
        metadata: {
          order_id: order.id,
          cancel_action: `${base}/checkout/status?reference=${reference}`,
          custom_fields: [{ display_name: "Customer", variable_name: "customer_name", value: order.customerName }],
        },
      });
      const updated = await db.order.update({
        where: { id: order.id },
        data: { paystackAccessCode: result.access_code, paystackAuthUrl: result.authorization_url },
        include: { items: true },
      });
      return ok(checkoutResponse(updated), 201);
    } catch (err) {
      lastError = err;
      if (err instanceof PaymentsNotConfiguredError) break;
      if (err instanceof PaystackError && !err.retryable && !/duplicate/i.test(err.message)) break;
    }
  }

  logger.error("checkout.initialize_failed", { reference: order.reference, error: lastError });
  const retryable = !(lastError instanceof PaystackError) || lastError.retryable;
  return apiError(
    retryable ? 503 : 502,
    "PAYMENT_INIT_FAILED",
    retryable
      ? "We couldn't reach our payment provider. Your card has NOT been charged — please try again."
      : "Our payment provider declined to start this payment. Your card has NOT been charged.",
    { retryable },
  );
}

function checkoutResponse(order: OrderWithItems) {
  return {
    reference: order.reference,
    accessCode: order.paystackAccessCode!,
    authorizationUrl: order.paystackAuthUrl!,
    amountKobo: order.amountKobo,
  };
}

function hashRequest(input: CheckoutInput): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, website, ...rest } = input;
  const canonical = JSON.stringify({ ...rest, items: [...rest.items].sort((a, b) => a.containerId.localeCompare(b.containerId)) });
  return createHash("sha256").update(canonical).digest("hex");
}
