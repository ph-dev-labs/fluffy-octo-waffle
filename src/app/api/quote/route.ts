import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { quoteSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "quote", 5);
  if (blocked) return blocked;
  const parsed = await parseJson(req, quoteSchema);
  if ("error" in parsed) return parsed.error;
  const { website, ...data } = parsed.data;
  // Honeypot hit: pretend success so bots learn nothing.
  if (website) return ok({ received: true }, 201);

  try {
    await db.quoteRequest.create({ data: { ...data, size: data.size || null, message: data.message || null } });
  } catch (err) {
    logger.error("quote.save_failed", { error: err });
    return apiError(500, "SAVE_FAILED", "We couldn't send your request. Please try again.", { retryable: true });
  }
  // TODO(client): notify sales (e.g. Resend / Postmark email) — keep it async/non-blocking.
  return ok({ received: true }, 201);
}
