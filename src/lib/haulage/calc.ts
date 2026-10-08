// Pure truck-hire payment maths (no I/O, unit-tested). All amounts in kobo.

export const HAULAGE_JOB_STATUSES = ["AWAITING_PAYMENT", "CONFIRMED", "SCHEDULED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;

export type PaymentPlan = "FULL" | "DEPOSIT";
export type HaulagePaymentState = "UNPAID" | "PART_PAID" | "PAID" | "OVERPAID";

/** Deposit for a booking, rounded up to the next whole naira so the balance is never fractional. */
export function depositKobo(totalKobo: number, depositPct: number) {
  const pct = Math.min(Math.max(depositPct, 1), 99);
  return Math.min(totalKobo, Math.ceil((totalKobo * pct) / 100 / 100) * 100);
}

export function outstandingKobo(totalKobo: number, paidKobo: number) {
  return Math.max(0, totalKobo - paidKobo);
}

export function paymentState(totalKobo: number, paidKobo: number): HaulagePaymentState {
  if (paidKobo <= 0) return "UNPAID";
  if (paidKobo < totalKobo) return "PART_PAID";
  if (paidKobo === totalKobo) return "PAID";
  return "OVERPAID";
}

export type NextPayment = { ok: true; kind: "FULL" | "DEPOSIT" | "BALANCE"; amountKobo: number } | { ok: false; reason: string };

/**
 * What the customer may pay next. Before anything is paid they choose the full
 * amount or the deposit; after a deposit, only the remaining balance.
 */
export function nextPayment(opts: { plan: PaymentPlan; totalKobo: number; paidKobo: number; depositPct: number; allowDeposit: boolean }): NextPayment {
  const due = outstandingKobo(opts.totalKobo, opts.paidKobo);
  if (due <= 0) return { ok: false, reason: "This booking is already fully paid." };
  if (opts.paidKobo > 0) return { ok: true, kind: "BALANCE", amountKobo: due };
  if (opts.plan === "DEPOSIT") {
    if (!opts.allowDeposit) return { ok: false, reason: "Part payment isn't available — please pay in full." };
    return { ok: true, kind: "DEPOSIT", amountKobo: depositKobo(opts.totalKobo, opts.depositPct) };
  }
  return { ok: true, kind: "FULL", amountKobo: opts.totalKobo };
}
