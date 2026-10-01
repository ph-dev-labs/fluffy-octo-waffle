import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, decide } from "../src/lib/payment-rules";

const expected = { reference: "CZ_ABC123_DEADBEEF", amountKobo: 245_000_000, currency: "NGN" };
const tx = (over: Partial<{ status: string; reference: string; amount: number; currency: string }> = {}) => ({
  status: "success",
  reference: expected.reference,
  amount: expected.amountKobo,
  currency: "NGN",
  ...over,
});

test("exact successful payment → PAID", () => {
  assert.deepEqual(decide("PENDING", expected, tx()), { next: "PAID" });
});

test("successful payment with lower amount is NEVER marked paid", () => {
  const d = decide("PENDING", expected, tx({ amount: expected.amountKobo - 1 }));
  assert.equal(d.next, "AMOUNT_MISMATCH");
});

test("successful payment in wrong currency is NEVER marked paid", () => {
  assert.equal(decide("PENDING", expected, tx({ currency: "USD" })).next, "AMOUNT_MISMATCH");
});

test("reference mismatch is flagged", () => {
  assert.equal(decide("PENDING", expected, tx({ reference: "CZ_OTHER_00000000" })).next, "AMOUNT_MISMATCH");
});

test("in-flight statuses keep the order PENDING (money may still arrive)", () => {
  for (const status of ["abandoned", "ongoing", "pending", "processing", "queued"]) {
    assert.equal(decide("PENDING", expected, tx({ status })).next, "PENDING", status);
  }
});

test("failed → FAILED, and a later success on the same reference can still PAY", () => {
  assert.equal(decide("PENDING", expected, tx({ status: "failed" })).next, "FAILED");
  assert.equal(canTransition("FAILED", "PAID"), true);
  assert.equal(canTransition("ABANDONED", "PAID"), true);
});

test("reversal of a PAID order is escalated, not silently downgraded", () => {
  assert.equal(decide("PAID", expected, tx({ status: "reversed" })).next, "REVIEW_REVERSAL");
});

test("final statuses can never be changed automatically", () => {
  for (const from of ["PAID", "AMOUNT_MISMATCH", "REFUNDED"] as const) {
    for (const to of ["PENDING", "FAILED", "PAID", "ABANDONED"] as const) {
      assert.equal(canTransition(from, to), false, `${from} → ${to}`);
    }
  }
});

test("no-op transitions are rejected (idempotency)", () => {
  assert.equal(canTransition("PENDING", "PENDING"), false);
});
