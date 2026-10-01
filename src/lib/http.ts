import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "./env";
import { fieldErrors } from "./validation";
import { rateLimit } from "./rate-limit";

export interface ApiErrorBody {
  error: { code: string; message: string; retryable?: boolean; fields?: Record<string, string> };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: { retryable?: boolean; fields?: Record<string, string>; headers?: HeadersInit } = {},
) {
  const { headers, ...rest } = extra;
  return NextResponse.json<ApiErrorBody>({ error: { code, message, ...rest } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * CSRF defence for JSON endpoints: the request must come from our own origin.
 * Browsers always send Origin on cross-site POSTs, so a mismatch is rejected.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const allowed = new Set([new URL(env().APP_URL).origin, req.nextUrl.origin]);
  return allowed.has(origin);
}

/** Common guard for public state-changing JSON endpoints. */
export function guardPost(req: NextRequest, bucket: string, limit: number, windowMs = 60_000) {
  if (!isSameOrigin(req)) return apiError(403, "FORBIDDEN_ORIGIN", "Request origin not allowed.");
  if (!req.headers.get("content-type")?.includes("application/json"))
    return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json.");
  const rl = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (!rl.ok)
    return apiError(429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again.", {
      retryable: true,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  return null;
}

const MAX_BODY_BYTES = 32 * 1024;

export async function parseJson<S extends z.ZodType>(req: NextRequest, schema: S) {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { error: apiError(413, "PAYLOAD_TOO_LARGE", "Request body too large.") } as const;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: apiError(400, "INVALID_JSON", "Malformed JSON body.") } as const;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return { error: apiError(422, "VALIDATION_FAILED", "Please check the highlighted fields.", { fields: fieldErrors(parsed.error) }) } as const;
  return { data: parsed.data as z.infer<S> } as const;
}
