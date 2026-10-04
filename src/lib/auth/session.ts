import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminUser } from "@prisma/client";
import { db } from "@/lib/db";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h absolute lifetime
const isProd = process.env.NODE_ENV === "production";

/** `__Host-` prefix = browser enforces Secure, Path=/ and no Domain (prod only, needs HTTPS). */
export const SESSION_COOKIE = isProd ? "__Host-cz_admin" : "cz_admin";

export type AdminRole = "OWNER" | "ADMIN";
export type SessionUser = Pick<AdminUser, "id" | "email" | "name" | "role" | "mustChangePassword">;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const meta = await requestMeta();
  await db.adminSession.create({
    data: { tokenHash: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), ...meta },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revokes every session for a user (password change, deactivation). */
export async function revokeAllSessions(userId: string, exceptCurrent = false) {
  const token = exceptCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  await db.adminSession.deleteMany({ where: { userId, ...(token ? { tokenHash: { not: sha256(token) } } : {}) } });
}

/** Current admin, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, active: true, mustChangePassword: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { active: _active, ...user } = session.user;
  return user;
});

/**
 * Gate for every admin page and server action. Never rely on middleware or
 * hidden UI alone — each mutation calls this itself.
 */
export async function requireAdmin(opts: { role?: AdminRole; allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/admin/account?first=1");
  if (opts.role === "OWNER" && user.role !== "OWNER") redirect("/admin?denied=1");
  return user;
}
