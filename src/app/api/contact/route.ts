import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { notifyOps } from "@/lib/mail";
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
  await notifyOps(`New contact message — ${data.subject}`, { Name: data.fullName, Email: data.email, Subject: data.subject, Message: data.message }, data.email).catch(() => {});
  return ok({ received: true }, 201);
}
