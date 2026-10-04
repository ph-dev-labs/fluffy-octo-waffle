import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";
import { logger } from "./logger";

// Signed direct-to-Cloudinary uploads: the browser uploads the file straight
// to Cloudinary (no Vercel body-size limit), but only with a short-lived
// signature our server issues to logged-in admins. The API secret never
// leaves the server.

export const UPLOAD_FOLDERS = ["containers", "gallery"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export function cloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = env();
  if (!cloud || !key || !secret) return null;
  return { cloud, key, secret, root: env().CLOUDINARY_FOLDER };
}

/** Cloudinary signature: SHA-1 of alphabetically sorted `k=v` pairs + secret. */
export function signParams(params: Record<string, string | number>, secret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export function createUploadSignature(folder: UploadFolder) {
  const cfg = cloudinaryConfig();
  if (!cfg) return null;
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    folder: `${cfg.root}/${folder}`,
    allowed_formats: folder === "gallery" ? "jpg,jpeg,png,webp,avif,heic,mp4,mov,webm" : "jpg,jpeg,png,webp,avif,heic",
  };
  return {
    ...params,
    signature: signParams(params, cfg.secret),
    apiKey: cfg.key,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloud}/auto/upload`,
  };
}

/** Only accept media hosted in OUR Cloudinary account/folder (or legacy hosts). */
export function isAllowedMediaUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const cfg = cloudinaryConfig();
  if (cfg && u.hostname === "res.cloudinary.com") return u.pathname.startsWith(`/${cfg.cloud}/`) && u.pathname.includes(`/${cfg.root}/`);
  return LEGACY_MEDIA_HOSTS.includes(u.hostname);
}

export const LEGACY_MEDIA_HOSTS = ["pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev"];

/** Extracts { resourceType, publicId } from one of our Cloudinary delivery URLs. */
export function parseCloudinaryUrl(url: string): { resourceType: "image" | "video"; publicId: string } | null {
  const cfg = cloudinaryConfig();
  if (!cfg) return null;
  const m = new URL(url).pathname.match(new RegExp(`^/${cfg.cloud}/(image|video)/upload/(?:[^/]*,[^/]*/)*(?:v\\d+/)?(.+)\\.[a-z0-9]+$`, "i"));
  if (!m || !m[2].startsWith(`${cfg.root}/`)) return null;
  return { resourceType: m[1] as "image" | "video", publicId: m[2] };
}

/** Best-effort delete when an admin removes media. Never throws. */
export async function destroyMedia(url: string) {
  const cfg = cloudinaryConfig();
  const parsed = cfg && url.includes("res.cloudinary.com") ? parseCloudinaryUrl(url) : null;
  if (!cfg || !parsed) return;
  const params = { public_id: parsed.publicId, timestamp: Math.floor(Date.now() / 1000), invalidate: "true" };
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: cfg.key, signature: signParams(params, cfg.secret) });
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/${parsed.resourceType}/destroy`, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) logger.warn("cloudinary.destroy_failed", { publicId: parsed.publicId, status: res.status });
  } catch (err) {
    logger.warn("cloudinary.destroy_error", { publicId: parsed.publicId, error: err });
  }
}
