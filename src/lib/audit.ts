import "server-only";
import { db } from "./db";
import { logger } from "./logger";
import { requestMeta } from "./auth/session";

/** Append-only record of admin actions ("who changed what, when, from where"). */
export async function audit(userId: string | null, action: string, target?: string | null, detail?: string | null) {
  try {
    const { ip } = await requestMeta();
    await db.auditLog.create({ data: { userId, action, target: target ?? null, detail: detail?.slice(0, 1000) ?? null, ip } });
  } catch (err) {
    logger.warn("audit.write_failed", { action, error: err });
  }
}
