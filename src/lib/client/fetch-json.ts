"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryable: boolean,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "You appear to be offline. Check your connection and try again.") {
    super(message);
    this.name = "NetworkError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolves when the browser reports it is back online (or immediately if it is). */
export function waitForOnline(timeoutMs = 30_000): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(done, timeoutMs);
    window.addEventListener("online", done);
  });
}

interface Options extends Omit<RequestInit, "body"> {
  json?: unknown;
  /** Number of retries on network errors / 5xx / 429. Only use on idempotent calls. */
  retries?: number;
  timeoutMs?: number;
}

/**
 * fetch + JSON with a hard timeout, offline awareness, and exponential
 * backoff on transient errors. Only retry requests that are idempotent
 * (GETs, or POSTs carrying an idempotency key).
 */
export async function fetchJson<T>(url: string, { json, retries = 0, timeoutMs = 20_000, headers, ...init }: Options = {}): Promise<T> {
  let last: Error = new NetworkError();

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await waitForOnline();
      await sleep(Math.min(8_000, 600 * 2 ** (attempt - 1)) + Math.random() * 300);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        credentials: "same-origin",
      });
    } catch (err) {
      last = (err as Error).name === "TimeoutError" ? new NetworkError("The request timed out. Your connection may be slow.") : new NetworkError();
      continue;
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* empty / non-JSON */
    }

    if (res.ok) return body as T;

    const e = (body as { error?: { code?: string; message?: string; retryable?: boolean; fields?: Record<string, string> } })?.error;
    const retryable = e?.retryable ?? (res.status >= 500 || res.status === 429);
    last = new ApiError(e?.message ?? `Request failed (${res.status})`, res.status, e?.code ?? "HTTP_ERROR", retryable, e?.fields);
    if (!retryable) throw last;
  }

  throw last;
}
