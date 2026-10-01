import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { logger } from "./logger";

const BASE_URL = "https://api.paystack.co";

export type PaystackTxStatus =
  | "success"
  | "failed"
  | "abandoned"
  | "reversed"
  | "ongoing"
  | "pending"
  | "processing"
  | "queued";

export interface PaystackTransaction {
  id: number;
  status: PaystackTxStatus;
  reference: string;
  amount: number; // kobo
  currency: string;
  paid_at: string | null;
  channel: string | null;
  gateway_response: string | null;
  customer?: { email?: string };
}

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
    /** True when the failure is transient (network, timeout, 5xx, 429). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("Payments are not configured (PAYSTACK_SECRET_KEY missing).");
    this.name = "PaymentsNotConfiguredError";
  }
}

function secretKey(): string {
  const key = env().PAYSTACK_SECRET_KEY;
  if (!key) throw new PaymentsNotConfiguredError();
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  retries?: number;
  timeoutMs?: number;
}

/**
 * Calls the Paystack API with a hard timeout and exponential backoff + jitter
 * on transient failures. Non-transient errors (4xx) are thrown immediately.
 */
async function request<T>(path: string, { method = "GET", body, retries = 2, timeoutMs = 15_000 }: RequestOptions = {}): Promise<T> {
  let lastError: PaystackError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(Math.min(4_000, 400 * 2 ** attempt) + Math.random() * 250);

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      if (err instanceof PaymentsNotConfiguredError) throw err;
      lastError = new PaystackError(`Network error talking to Paystack: ${(err as Error).message}`, null, true);
      logger.warn("paystack.network_error", { path, attempt, error: err });
      continue;
    }

    let json: { status?: boolean; message?: string; data?: T } | null = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body (e.g. gateway HTML) */
    }

    if (res.ok && json?.status) return json.data as T;

    const retryable = res.status >= 500 || res.status === 429;
    lastError = new PaystackError(json?.message ?? `Paystack HTTP ${res.status}`, res.status, retryable);
    logger.warn("paystack.http_error", { path, attempt, httpStatus: res.status, message: lastError.message });
    if (!retryable) throw lastError;
  }

  throw lastError ?? new PaystackError("Unknown Paystack error", null, true);
}

export interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  currency: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/**
 * No automatic retries here: if a request times out we can't know whether
 * Paystack created the transaction. The checkout handler retries with a
 * *fresh* reference instead, which is always safe because a customer can only
 * ever pay through an access code we actually handed back to them.
 */
export function initializeTransaction(input: InitializeInput): Promise<InitializeResult> {
  return request<InitializeResult>("/transaction/initialize", {
    method: "POST",
    retries: 0,
    body: {
      email: input.email,
      amount: input.amountKobo,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    },
  });
}

export type VerifyResult = { found: true; transaction: PaystackTransaction } | { found: false };

/** Verify is read-only and therefore safe to retry aggressively. */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  try {
    const transaction = await request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`, { retries: 3 });
    return { found: true, transaction };
  } catch (err) {
    if (err instanceof PaystackError && (err.httpStatus === 400 || err.httpStatus === 404) && /not found/i.test(err.message)) {
      return { found: false };
    }
    throw err;
  }
}

/**
 * Verifies `x-paystack-signature` (HMAC-SHA512 of the *raw* body using the
 * secret key) in constant time.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null, key = secretKey()): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", key).update(rawBody, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
