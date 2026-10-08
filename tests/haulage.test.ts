import { test } from "node:test";
import assert from "node:assert/strict";
import { depositKobo, nextPayment, outstandingKobo, paymentState } from "../src/lib/haulage/calc";

const base = { totalKobo: 455_000_00, depositPct: 50, allowDeposit: true };

test("deposit is the % of the total, rounded UP to a whole naira", () => {
  assert.equal(depositKobo(455_000_00, 50), 227_500_00);
  assert.equal(depositKobo(100_001, 30), 30_100); // ₦300.003 → ₦301
  assert.equal(depositKobo(500, 99), 500); // never above the total
});

test("before any payment: full or deposit", () => {
  assert.deepEqual(nextPayment({ ...base, plan: "FULL", paidKobo: 0 }), { ok: true, kind: "FULL", amountKobo: 455_000_00 });
  assert.deepEqual(nextPayment({ ...base, plan: "DEPOSIT", paidKobo: 0 }), { ok: true, kind: "DEPOSIT", amountKobo: 227_500_00 });
});

test("deposit refused when the admin has switched part payment off", () => {
  assert.equal(nextPayment({ ...base, allowDeposit: false, plan: "DEPOSIT", paidKobo: 0 }).ok, false);
});

test("after a deposit, only the exact balance can be paid (whatever plan is sent)", () => {
  for (const plan of ["FULL", "DEPOSIT"] as const) {
    assert.deepEqual(nextPayment({ ...base, plan, paidKobo: 227_500_00 }), { ok: true, kind: "BALANCE", amountKobo: 227_500_00 });
  }
});

test("nothing due once fully paid (or overpaid)", () => {
  assert.equal(nextPayment({ ...base, plan: "FULL", paidKobo: 455_000_00 }).ok, false);
  assert.equal(nextPayment({ ...base, plan: "FULL", paidKobo: 500_000_00 }).ok, false);
  assert.equal(outstandingKobo(455_000_00, 500_000_00), 0);
});

test("payment state", () => {
  assert.equal(paymentState(100, 0), "UNPAID");
  assert.equal(paymentState(100, 40), "PART_PAID");
  assert.equal(paymentState(100, 100), "PAID");
  assert.equal(paymentState(100, 140), "OVERPAID");
});
