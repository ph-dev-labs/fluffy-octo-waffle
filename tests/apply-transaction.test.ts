// Integration test against a throwaway Postgres DB: proves that concurrent
// confirmations (webhook + status poller + cron) mark an order PAID once and
// decrement stock exactly once.
//
// Runs only when TEST_DATABASE_URL is set — point it at a SEPARATE, empty
// database (e.g. a Neon branch). It is wiped on every run.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import type { PaystackTransaction, PaystackTxStatus } from "../src/lib/paystack";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
const opts = { skip: TEST_DB ? false : "set TEST_DATABASE_URL to run DB integration tests" };

// Imported lazily so DATABASE_URL above is set before Prisma initialises.
let db: typeof import("../src/lib/db").db;
let applyTransaction: typeof import("../src/lib/payments").applyTransaction;

before(async () => {
  if (!TEST_DB) return;
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "ignore", env: { ...process.env } });
  ({ db } = await import("../src/lib/db"));
  ({ applyTransaction } = await import("../src/lib/payments"));
});

after(async () => {
  await db?.$disconnect();
});

async function makeOrder(stock: number, qty: number) {
  const c = await db.container.create({
    data: { slug: `t-${Math.random().toString(36).slice(2)}`, title: "Test 20ft", summary: "s", description: "d", size: "20FT", type: "DRY", condition: "USED", terminal: "T", priceKobo: 100_00, images: "[]", stock },
  });
  const ref = `CZ_TEST_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const order = await db.order.create({
    data: {
      reference: ref, idempotencyKey: crypto.randomUUID(), requestHash: "h", subtotalKobo: 100_00 * qty, deliveryKobo: 0, amountKobo: 100_00 * qty,
      customerName: "A", customerEmail: "a@b.co", customerPhone: "08000000000", fulfilment: "PICKUP", paystackAccessCode: "ac",
      items: { create: [{ containerId: c.id, title: c.title, unitPriceKobo: 100_00, quantity: qty }] },
    },
    include: { items: true },
  });
  return { c, order };
}

const tx = (reference: string, amount: number, status: PaystackTxStatus = "success"): PaystackTransaction => ({
  id: 1, status, reference, amount, currency: "NGN", paid_at: new Date().toISOString(), channel: "card", gateway_response: "Approved",
});

test("concurrent confirmations: PAID once, stock decremented once", opts, async () => {
  const { c, order } = await makeOrder(5, 2);
  const results = await Promise.allSettled([
    applyTransaction(order, tx(order.reference, order.amountKobo), "webhook"),
    applyTransaction(order, tx(order.reference, order.amountKobo), "poll"),
    applyTransaction(order, tx(order.reference, order.amountKobo), "cron"),
  ]);
  // SQLite may reject a concurrent writer; a retry (as webhook/poller do) must also be a no-op.
  if (results.some((r) => r.status === "rejected")) await applyTransaction(order, tx(order.reference, order.amountKobo), "retry");

  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  const container = await db.container.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(fresh.status, "PAID");
  assert.equal(container.stock, 3, "stock must be decremented exactly once");
});

test("underpayment is flagged and never fulfils", opts, async () => {
  const { c, order } = await makeOrder(5, 1);
  await applyTransaction(order, tx(order.reference, order.amountKobo - 1), "webhook");
  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(fresh.status, "AMOUNT_MISMATCH");
  assert.equal(fresh.needsReview, true);
  assert.equal((await db.container.findUniqueOrThrow({ where: { id: c.id } })).stock, 5);
});

test("failed then succeeded on retry → PAID", opts, async () => {
  const { order } = await makeOrder(5, 1);
  const failed = await applyTransaction(order, tx(order.reference, order.amountKobo, "failed"), "poll");
  assert.equal(failed.status, "FAILED");
  const paid = await applyTransaction(failed, tx(order.reference, order.amountKobo), "webhook");
  assert.equal(paid.status, "PAID");
});

test("paid but out of stock → stays PAID and flagged for review (never lose the payment)", opts, async () => {
  const { order } = await makeOrder(0, 1);
  const res = await applyTransaction(order, tx(order.reference, order.amountKobo), "webhook");
  assert.equal(res.status, "PAID");
  assert.equal(res.needsReview, true);
});
