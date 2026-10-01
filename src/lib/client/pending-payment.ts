"use client";

// Persists the in-flight payment reference BEFORE the Paystack window opens,
// so that if the tab closes, the phone dies or the network drops mid-payment,
// the site can pick up verification the next time the customer visits.

const KEY = "cz.pendingPayment.v1";
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

export interface PendingPayment {
  reference: string;
  amountKobo: number;
  /** Lets the status page re-open the SAME Paystack session instead of starting a new charge. */
  accessCode: string;
  authorizationUrl: string;
  startedAt: number;
}

export function savePending(p: Omit<PendingPayment, "startedAt">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, startedAt: Date.now() }));
    window.dispatchEvent(new Event("cz:pending-payment"));
  } catch {
    /* storage disabled (private mode) — server-side reconciliation still covers us */
  }
}

export function readPending(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingPayment;
    if (!p?.reference || Date.now() - p.startedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPending(reference?: string) {
  try {
    const current = readPending();
    if (!reference || current?.reference === reference) localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("cz:pending-payment"));
  } catch {
    /* ignore */
  }
}

const IDEM_KEY = "cz.checkoutKey.v1";

/**
 * Returns a stable idempotency key for a given checkout payload fingerprint.
 * Same cart + same details ⇒ same key ⇒ retries can never double-charge.
 * Any change ⇒ new key ⇒ new order.
 */
export function idempotencyKeyFor(fingerprint: string): string {
  try {
    const stored = JSON.parse(sessionStorage.getItem(IDEM_KEY) ?? "null") as { fp: string; key: string } | null;
    if (stored?.fp === fingerprint) return stored.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(IDEM_KEY, JSON.stringify({ fp: fingerprint, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function resetIdempotencyKey() {
  try {
    sessionStorage.removeItem(IDEM_KEY);
  } catch {
    /* ignore */
  }
}
