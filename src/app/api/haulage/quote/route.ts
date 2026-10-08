import type { NextRequest } from "next/server";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { quoteHaulage, signHaulageQuote } from "@/lib/haulage/service";
import { haulageQuoteSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** POST /api/haulage/quote — prices a truck from the pickup pin to the drop-off pin; returns a signed quote. */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "haulage-quote", 30);
  if (blocked) return blocked;
  const parsed = await parseJson(req, haulageQuoteSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const outcome = await quoteHaulage(parsed.data);
    if (!outcome.ok) return ok(outcome);
    const { ok: _ok, ...quote } = outcome;
    void _ok;
    return ok({ ...outcome, token: signHaulageQuote(quote) });
  } catch (err) {
    logger.error("haulage.quote_failed", { error: err });
    return apiError(503, "QUOTE_FAILED", "We couldn't price this trip right now. Please try again.", { retryable: true });
  }
}
