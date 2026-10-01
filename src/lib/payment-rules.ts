// Pure payment decision logic — no I/O, fully unit-tested (tests/payment-rules.test.ts).

export const ORDER_STATUSES = ["PENDING", "PAID", "FAILED", "ABANDONED", "AMOUNT_MISMATCH", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Statuses we never change automatically once reached. FAILED / ABANDONED are
 * deliberately NOT final: Paystack lets a customer retry with another card on
 * the same reference, and a bank transfer can settle late. Treating those as
 * final is exactly how payments "go missing".
 */
export const FINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(["PAID", "AMOUNT_MISMATCH", "REFUNDED"]);

export interface ExpectedPayment {
  reference: string;
  amountKobo: number;
  currency: string;
}

export interface GatewayResult {
  status: string;
  reference: string;
  amount: number;
  currency: string;
}

export type Decision =
  | { next: "PAID" }
  | { next: "AMOUNT_MISMATCH"; note: string }
  | { next: "FAILED" }
  | { next: "PENDING" }
  | { next: "REVIEW_REVERSAL"; note: string };

export function decide(current: OrderStatus, expected: ExpectedPayment, tx: GatewayResult): Decision {
  if (tx.reference !== expected.reference) {
    return { next: "AMOUNT_MISMATCH", note: `Reference mismatch: expected ${expected.reference}, got ${tx.reference}` };
  }

  switch (tx.status) {
    case "success": {
      if (tx.amount !== expected.amountKobo || tx.currency.toUpperCase() !== expected.currency.toUpperCase()) {
        return {
          next: "AMOUNT_MISMATCH",
          note: `Paid ${tx.currency} ${tx.amount} but expected ${expected.currency} ${expected.amountKobo}`,
        };
      }
      return { next: "PAID" };
    }
    case "reversed":
      // Never silently downgrade a paid order — a human must look at it.
      if (current === "PAID") return { next: "REVIEW_REVERSAL", note: "Paystack reports this transaction as reversed." };
      return { next: "FAILED" };
    case "failed":
      return { next: "FAILED" };
    default:
      // abandoned | ongoing | pending | processing | queued — money may still arrive.
      return { next: "PENDING" };
  }
}

/** Whether moving from `current` to `next` is allowed by the state machine. */
export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return false;
  if (FINAL_STATUSES.has(current)) return false;
  return true;
}
