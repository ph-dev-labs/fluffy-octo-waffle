"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { CONTAINER_SIZES } from "@/lib/delivery/calc";
import { syncHaulagePayment } from "@/lib/haulage/payments";
import { getHaulageConfig } from "@/lib/haulage/service";
import { HAULAGE_JOB_STATUSES } from "@/lib/haulage/calc";
import { lastMailError, sendHaulageBalanceReminder } from "@/lib/mail";
import type { ActionState } from "./types";

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
const checkbox = z.literal("on").optional().transform((v) => v === "on");
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const jobSchema = z.object({
  status: z.enum(HAULAGE_JOB_STATUSES),
  scheduledFor: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date"),
  driverName: optional(120),
  driverPhone: optional(30),
  truckPlate: optional(30),
  adminNote: optional(2000),
  clearReview: checkbox,
});

export async function updateHaulageJobAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = jobSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const { clearReview, ...data } = parsed.data;
  const before = await db.haulageRequest.findUniqueOrThrow({ where: { id } });

  // Payment drives "awaiting payment" ↔ "confirmed"; staff can't confirm an unpaid job by hand.
  if (data.status !== "CANCELLED" && data.status !== "AWAITING_PAYMENT" && before.paidKobo === 0) {
    return { message: "Nothing has been paid on this booking yet — it can't be scheduled. (You can cancel it.)" };
  }
  if (data.status === "AWAITING_PAYMENT" && before.paidKobo > 0) return { message: "This booking has payments, so it can't go back to 'awaiting payment'." };

  await db.haulageRequest.update({ where: { id }, data: { ...data, ...(clearReview ? { needsReview: false, reviewNote: null } : {}) } });
  await audit(admin.id, "haulage.update", before.reference, `${before.status} → ${data.status}${data.truckPlate ? `, truck ${data.truckPlate}` : ""}${clearReview ? ", review cleared" : ""}`);
  revalidatePath(`/admin/haulage/${id}`);
  revalidatePath("/admin/haulage");
  return { ok: true, message: "Booking updated." };
}

export async function reverifyHaulageAction(id: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const payments = await db.haulagePayment.findMany({ where: { requestId: id, paystackAccessCode: { not: null }, status: { in: ["PENDING", "FAILED", "ABANDONED"] } } });
  let changed = 0;
  for (const p of payments) {
    try {
      const fresh = await syncHaulagePayment(p.reference, "admin");
      if (fresh && fresh.status !== p.status) changed++;
    } catch {
      return { message: "Couldn't reach Paystack right now. Try again in a minute." };
    }
  }
  const r = await db.haulageRequest.findUniqueOrThrow({ where: { id } });
  await audit(admin.id, "haulage.reverify", r.reference, `${payments.length} checked, ${changed} changed`);
  revalidatePath(`/admin/haulage/${id}`);
  return { ok: true, message: payments.length ? `Checked ${payments.length} payment${payments.length === 1 ? "" : "s"} with Paystack — ${changed} updated.` : "No open payments to check." };
}

export async function sendHaulageReminderAction(id: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const r = await db.haulageRequest.findUniqueOrThrow({ where: { id } });
  if (r.paidKobo >= r.totalKobo) return { message: "Nothing is outstanding on this booking." };
  const ok = await sendHaulageBalanceReminder(id);
  if (!ok) return { message: `The reminder couldn't be sent — ${lastMailError ?? "unknown error"}.` };
  await audit(admin.id, "haulage.reminder", r.reference, r.customerEmail);
  return { ok: true, message: `Payment reminder sent to ${r.customerEmail}.` };
}

// ── Settings ─────────────────────────────────────────────────────────────

const naira = (label: string) => z.coerce.number(`Enter ${label}`).min(0, "Can't be negative").max(100_000_000, "Too large");
const settingsSchema = z
  .object({
    enabled: checkbox,
    baseFee: naira("a base fee"),
    ratePerKm: naira("a rate per km"),
    minFee: naira("a minimum"),
    maxFee: naira("a maximum"),
    maxDistanceKm: z.coerce.number("Enter a distance").int().min(1).max(5000),
    allowDeposit: checkbox,
    depositPct: z.coerce.number("Enter a %").int().min(10, "At least 10%").max(90, "At most 90%"),
    ...Object.fromEntries(CONTAINER_SIZES.map((s) => [`m_${s}`, z.coerce.number("Enter a %").int().min(10).max(1000)])),
  })
  .refine((v) => v.minFee <= v.maxFee, { path: ["maxFee"], message: "Must be at least the minimum" });

export async function saveHaulageSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const v = parsed.data as z.infer<typeof settingsSchema> & Record<string, number>;
  await getHaulageConfig(); // make sure the row exists
  const data = {
    enabled: v.enabled,
    baseFeeKobo: Math.round(v.baseFee * 100),
    ratePerKmKobo: Math.round(v.ratePerKm * 100),
    minFeeKobo: Math.round(v.minFee * 100),
    maxFeeKobo: Math.round(v.maxFee * 100),
    maxDistanceKm: v.maxDistanceKm,
    allowDeposit: v.allowDeposit,
    depositPct: v.depositPct,
    sizeMultipliers: JSON.stringify(Object.fromEntries(CONTAINER_SIZES.map((s) => [s, v[`m_${s}`]]))),
  };
  await db.haulageSettings.update({ where: { id: 1 }, data });
  await audit(admin.id, "haulage.settings", "pricing", `on=${data.enabled} base=${v.baseFee} perKm=${v.ratePerKm} min=${v.minFee} max=${v.maxFee} deposit=${data.allowDeposit ? `${data.depositPct}%` : "off"}`);
  revalidatePath("/admin/haulage/settings");
  revalidatePath("/haulage");
  return { ok: true, message: "Truck hire pricing saved. New bookings use it immediately; existing bookings keep their price." };
}
