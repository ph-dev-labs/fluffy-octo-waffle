"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { notifyOrderPaid } from "@/lib/mail";
import { syncOrder } from "@/lib/payments";
import { PaymentsNotConfiguredError } from "@/lib/paystack";
import { FULFILMENT_STATUSES } from "@/components/admin/badges";
import type { ActionState } from "./types";

// NOTE: there is deliberately NO action to set an order's payment status.
// Payment status only ever comes from Paystack (verify API / signed webhook).

export async function reverifyOrderAction(id: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  try {
    const updated = await syncOrder(order.reference, `admin:${admin.email}`);
    await audit(admin.id, "order.reverify", order.reference, `${order.status} → ${updated?.status}`);
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true, message: updated?.status === order.status ? `Checked with Paystack — still ${order.status.toLowerCase()}.` : `Updated: ${order.status} → ${updated?.status}` };
  } catch (err) {
    if (err instanceof PaymentsNotConfiguredError) return { message: "Paystack isn't configured on this environment." };
    return { message: "Couldn't reach Paystack right now. Try again in a minute." };
  }
}

const fulfilSchema = z.object({
  fulfilmentStatus: z.enum(FULFILMENT_STATUSES),
  adminNote: z.string().trim().max(2000).optional(),
});

export async function updateFulfilmentAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = fulfilSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Invalid fulfilment status." };
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  if (order.status !== "PAID" && parsed.data.fulfilmentStatus !== "UNFULFILLED" && parsed.data.fulfilmentStatus !== "CANCELLED") {
    return { message: "Only paid orders can be processed or dispatched." };
  }
  await db.order.update({ where: { id }, data: { fulfilmentStatus: parsed.data.fulfilmentStatus, adminNote: parsed.data.adminNote || null } });
  await audit(admin.id, "order.fulfilment", order.reference, `${order.fulfilmentStatus} → ${parsed.data.fulfilmentStatus}`);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: "Order updated." };
}

export async function resolveReviewAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const note = String(fd.get("resolution") ?? "").trim().slice(0, 1000);
  if (note.length < 5) return { fields: { resolution: "Describe how this was resolved (e.g. refunded via Paystack, stock sourced)." } };
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  await db.order.update({
    where: { id },
    data: { needsReview: false, reviewNote: `${order.reviewNote ?? ""}\n[Resolved by ${admin.name} ${new Date().toISOString()}] ${note}`.trim() },
  });
  await audit(admin.id, "order.review_resolved", order.reference, note);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Marked as resolved." };
}

export async function resendReceiptAction(id: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const order = await db.order.findUniqueOrThrow({ where: { id } });
  if (order.status !== "PAID") return { message: "Receipts can only be sent for paid orders." };
  await db.order.update({ where: { id }, data: { receiptSentAt: null } });
  await notifyOrderPaid(id);
  const after = await db.order.findUniqueOrThrow({ where: { id }, select: { receiptSentAt: true } });
  await audit(admin.id, "order.resend_receipt", order.reference);
  revalidatePath(`/admin/orders/${id}`);
  return after.receiptSentAt ? { ok: true, message: `Receipt sent to ${order.customerEmail}.` } : { message: "Email couldn't be sent — check the email settings (RESEND_API_KEY / MAIL_FROM)." };
}
