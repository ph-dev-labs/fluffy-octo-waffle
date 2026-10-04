"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generatePassword, hashPassword } from "@/lib/auth/password";
import { requireAdmin, revokeAllSessions } from "@/lib/auth/session";
import type { ActionState } from "./types";

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  role: z.enum(["OWNER", "ADMIN"]),
});

/** Owner-only: creates an admin with a one-time temporary password shown once. */
export async function createAdminAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const owner = await requireAdmin({ role: "OWNER" });
  const parsed = createSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])) };
  const temp = generatePassword();
  try {
    await db.adminUser.create({ data: { ...parsed.data, passwordHash: await hashPassword(temp), mustChangePassword: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { fields: { email: "An admin with this email already exists" } };
    throw err;
  }
  await audit(owner.id, "admin.create", parsed.data.email, parsed.data.role);
  revalidatePath("/admin/users");
  return { ok: true, message: `Account created for ${parsed.data.email}. Temporary password:`, secret: temp };
}

export async function resetAdminPasswordAction(id: string, _: ActionState): Promise<ActionState> {
  const owner = await requireAdmin({ role: "OWNER" });
  const temp = generatePassword();
  const user = await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
  await revokeAllSessions(id);
  await audit(owner.id, "admin.reset_password", user.email);
  return { ok: true, message: `New temporary password for ${user.email}:`, secret: temp };
}

async function ownerCount() {
  return db.adminUser.count({ where: { role: "OWNER", active: true } });
}

export async function toggleAdminActiveAction(id: string) {
  const owner = await requireAdmin({ role: "OWNER" });
  if (id === owner.id) return; // can't lock yourself out
  const user = await db.adminUser.findUniqueOrThrow({ where: { id } });
  if (user.active && user.role === "OWNER" && (await ownerCount()) <= 1) return;
  await db.adminUser.update({ where: { id }, data: { active: !user.active } });
  if (user.active) await revokeAllSessions(id);
  await audit(owner.id, user.active ? "admin.deactivate" : "admin.activate", user.email);
  revalidatePath("/admin/users");
}

export async function setAdminRoleAction(id: string, role: "OWNER" | "ADMIN") {
  const owner = await requireAdmin({ role: "OWNER" });
  if (id === owner.id || !["OWNER", "ADMIN"].includes(role)) return;
  const user = await db.adminUser.findUniqueOrThrow({ where: { id } });
  if (user.role === "OWNER" && role === "ADMIN" && (await ownerCount()) <= 1) return;
  await db.adminUser.update({ where: { id }, data: { role } });
  await audit(owner.id, "admin.role", user.email, `${user.role} → ${role}`);
  revalidatePath("/admin/users");
}
