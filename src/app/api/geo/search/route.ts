import type { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/delivery/geo";
import { apiError, clientIp, isSameOrigin, ok } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** GET /api/geo/search?q=… — address search inside Nigeria (proxied OpenStreetMap). */
export async function GET(req: NextRequest) {
  if (!isSameOrigin(req)) return apiError(403, "FORBIDDEN_ORIGIN", "Request origin not allowed.");
  const rl = rateLimit(`geo-search:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return apiError(429, "RATE_LIMITED", "Too many searches. Wait a moment, or drop the pin on the map instead.", { retryable: true, headers: { "Retry-After": String(rl.retryAfterSec) } });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 200) return apiError(422, "VALIDATION_FAILED", "Type at least 3 characters.");
  try {
    return ok({ results: await searchPlaces(q) });
  } catch (err) {
    logger.warn("geo.search_failed", { error: err });
    return apiError(503, "SEARCH_UNAVAILABLE", "Address search is unavailable right now — drop the pin on the map instead.", { retryable: true });
  }
}
