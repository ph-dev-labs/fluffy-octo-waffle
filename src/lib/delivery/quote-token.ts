import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { DeliveryMethod } from "./calc";

// A delivery quote is signed by the server and handed to the browser, which
// sends it back with the checkout. Checkout charges exactly the quoted fee
// (no second routing call while the customer waits) and the browser can't
// alter it: any change breaks the signature.

export interface DeliveryQuote {
  v: 1;
  stateCode: string;
  stateLabel: string;
  areaCode: string | null;
  areaLabel: string | null;
  lat: number;
  lng: number;
  method: DeliveryMethod;
  distanceKm: number | null;
  yard: string | null;
  /** Fee for ONE container of each size, in kobo. */
  perSize: Record<string, number>;
  exp: number; // unix ms
}

export const QUOTE_TTL_MS = 45 * 60_000;

function key() {
  const e = env();
  const secret = process.env.QUOTE_SIGNING_SECRET || e.PAYSTACK_SECRET_KEY || e.CRON_SECRET;
  if (!secret) throw new Error("No secret available to sign delivery quotes (set QUOTE_SIGNING_SECRET).");
  // Derived so the raw Paystack key is never used directly as an HMAC key elsewhere.
  return createHmac("sha256", secret).update("cz-delivery-quote-v1").digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signQuote(q: Omit<DeliveryQuote, "v" | "exp">): { token: string; quote: DeliveryQuote } {
  const quote: DeliveryQuote = { v: 1, ...q, exp: Date.now() + QUOTE_TTL_MS };
  const body = b64(JSON.stringify(quote));
  const sig = b64(createHmac("sha256", key()).update(body).digest());
  return { token: `${body}.${sig}`, quote };
}

export type VerifyResult = { ok: true; quote: DeliveryQuote } | { ok: false; reason: "invalid" | "expired" };

export function verifyQuote(token: string): VerifyResult {
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "invalid" };
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  let quote: DeliveryQuote;
  try {
    quote = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (quote.v !== 1) return { ok: false, reason: "invalid" };
  if (quote.exp < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, quote };
}
