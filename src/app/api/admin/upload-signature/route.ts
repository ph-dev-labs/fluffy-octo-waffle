import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createUploadSignature, UPLOAD_FOLDERS } from "@/lib/cloudinary";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Issues a short-lived Cloudinary upload signature to a signed-in admin.
 * The signature pins the folder and allowed formats, so it can't be reused
 * to upload elsewhere in the account. Cloudinary rejects signatures > 1h old.
 */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "admin-upload-sign", 120);
  if (blocked) return blocked;

  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return apiError(401, "UNAUTHORIZED", "Please sign in again.");

  const parsed = await parseJson(req, z.object({ folder: z.enum(UPLOAD_FOLDERS) }));
  if ("error" in parsed) return parsed.error;

  const sig = createUploadSignature(parsed.data.folder);
  if (!sig) return apiError(503, "UPLOADS_NOT_CONFIGURED", "Image uploads aren't configured yet (Cloudinary keys missing).", { retryable: false });
  return ok(sig);
}
