import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { contactSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "contact", 5);
  if (blocked) return blocked;
  const parsed = await parseJson(req, contactSchema);
  if ("error" in parsed) return parsed.error;
  const { website, ...data } = parsed.data;
  // Honeypot hit: pretend success so bots learn nothing.
  if (website) return ok({ received: true }, 201);

  try {
    await db.contactMessage.create({ data });
  } catch (err) {
    logger.error("contact.save_failed", { error: err });
    return apiError(500, "SAVE_FAILED", "We couldn't send your message. Please try again.", { retryable: true });
  }
  // TODO(client): forward to support inbox (e.g. Resend / Postmark email) — keep it async/non-blocking.
  return ok({ received: true }, 201);
}
