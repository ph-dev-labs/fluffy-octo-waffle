"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { burnPasswordCheck, hashPassword, isStrongPassword, PASSWORD_RULES, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSessionUser, requestMeta, revokeAllSessions } from "@/lib/auth/session";
import type { ActionState } from "./types";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Incorrect email or password.";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

/** Only allow redirects back into the admin area (no open redirects). */
function safeNext(next?: string) {
  return next && /^\/admin(\/[\w\-/?=&.%]*)?$/.test(next) && !next.startsWith("//") ? next : "/admin";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { ip } = await requestMeta();
  if (!rateLimit(`admin-login:${ip}`, 10, 15 * 60_000).ok) return { message: "Too many attempts. Please wait 15 minutes and try again." };

  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: GENERIC };
  const { email, password, next } = parsed.data;

  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    await burnPasswordCheck(password); // equalise timing so emails can't be enumerated
    await audit(null, "auth.login_failed", email, "unknown or inactive account");
    return { message: GENERIC };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await burnPasswordCheck(password);
    return { message: "Too many attempts. Please wait 15 minutes and try again." };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db.adminUser.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
    });
    await audit(user.id, failed >= MAX_FAILED ? "auth.locked" : "auth.login_failed", user.email);
    return { message: GENERIC };
  }

  await db.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit(user.id, "auth.login", user.email);
  redirect(user.mustChangePassword ? "/admin/account?first=1" : safeNext(next));
}

export async function logoutAction() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout", user.email);
  redirect("/admin/login");
}

const changeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password").max(200),
    password: z.string().max(200).refine(isStrongPassword, PASSWORD_RULES),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Choose a password different from the current one" });

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const session = await getSessionUser();
  if (!session) redirect("/admin/login");
  const parsed = changeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };

  const user = await db.adminUser.findUniqueOrThrow({ where: { id: session.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return { fields: { current: "Current password is incorrect" } };

  await db.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false } });
  await revokeAllSessions(user.id, true); // sign out every other device
  await audit(user.id, "auth.password_changed", user.email);
  const first = user.mustChangePassword;
  if (first) redirect("/admin");
  return { ok: true, message: "Password updated. Other sessions have been signed out." };
}
