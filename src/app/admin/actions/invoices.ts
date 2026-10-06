"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { checkContainerNumber } from "@/lib/container-number";
import { logger } from "@/lib/logger";
import { lastMailError, sendInvoiceEmail } from "@/lib/mail";
import { expandUnits, formatInvoiceNumber, invoiceEligibility, loadInvoice, parseContainerNumbers, renderInvoicePdf } from "@/lib/invoice/service";
import type { ActionState } from "./types";

/**
 * Creates or updates the invoice for an order, then (intent = "send") emails
 * the PDF to the customer. Container numbers are validated against ISO 6346
 * and checked for duplicates on other invoices.
 */
export async function saveInvoiceAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, invoice: true } });

  const eligible = invoiceEligibility(order);
  if (!eligible.ok) return { message: eligible.reason };

  const units = expandUnits(order.items);
  const skipCheckDigit = fd.get("skipCheckDigit") === "on";
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000) || null;
  const intent = fd.get("intent") === "send" ? "send" : "draft";

  const fields: Record<string, string> = {};
  const numbers = units.map((_, i) => {
    const r = checkContainerNumber(String(fd.get(`container_${i}`) ?? ""), { skipCheckDigit });
    if (!r.ok) fields[`container_${i}`] = r.message;
    return r.value;
  });

  // Same number twice on this invoice?
  numbers.forEach((n, i) => {
    if (n && numbers.indexOf(n) !== i) fields[`container_${i}`] = "This container number is already listed above";
  });

  // Already invoiced on another order?
  if (!Object.keys(fields).length) {
    const others = await db.invoice.findMany({
      where: { orderId: { not: orderId }, OR: numbers.map((n) => ({ containerNumbers: { contains: `"${n}"` } })) },
      select: { number: true, containerNumbers: true },
    });
    for (const other of others) {
      const used = parseContainerNumbers(other.containerNumbers);
      numbers.forEach((n, i) => {
        if (used.includes(n)) fields[`container_${i}`] = `Already on invoice ${other.number}`;
      });
    }
  }

  if (Object.keys(fields).length) return { message: "Please check the highlighted container numbers.", fields };

  let invoiceId = order.invoice?.id;
  try {
    if (invoiceId) {
      await db.invoice.update({ where: { id: invoiceId }, data: { containerNumbers: JSON.stringify(numbers), note } });
      await audit(admin.id, "invoice.update", order.invoice!.number, numbers.join(", "));
    } else {
      // Two steps so the human-readable number comes from the DB sequence (no gaps from races).
      const created = await db.$transaction(async (trx) => {
        const draft = await trx.invoice.create({
          data: { number: `PENDING-${orderId}`, orderId, containerNumbers: JSON.stringify(numbers), note, createdById: admin.id },
        });
        return trx.invoice.update({ where: { id: draft.id }, data: { number: formatInvoiceNumber(draft.seq, draft.issuedAt) } });
      });
      invoiceId = created.id;
      await audit(admin.id, "invoice.create", created.number, `${order.reference}: ${numbers.join(", ")}`);
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { message: "An invoice was just created for this order by someone else — refresh the page." };
    throw err;
  }

  revalidatePath(`/admin/orders/${orderId}`);
  if (intent === "send") return sendInvoice(invoiceId, admin.id);
  return { ok: true, message: "Invoice saved as a draft. Preview it, then send it to the customer." };
}

export async function sendInvoiceAction(invoiceId: string, _: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  return sendInvoice(invoiceId, admin.id);
}

async function sendInvoice(invoiceId: string, adminId: string): Promise<ActionState> {
  const inv = await loadInvoice(invoiceId);
  if (!inv) return { message: "Invoice not found." };
  const eligible = invoiceEligibility(inv.order);
  if (!eligible.ok) return { message: eligible.reason };

  // Render the final (non-draft) PDF for the email.
  const finalInv = { ...inv, status: "SENT" };
  let pdf: Buffer;
  try {
    pdf = await renderInvoicePdf(finalInv);
  } catch (err) {
    logger.error("invoice.render_failed", { number: inv.number, error: err, stack: (err as Error)?.stack?.slice(0, 1500) });
    return { message: `Couldn't generate the PDF: ${(err as Error)?.message ?? "unknown error"}` };
  }

  const ok = await sendInvoiceEmail({
    to: inv.order.customerEmail,
    customerName: inv.order.customerName,
    invoiceNumber: inv.number,
    orderReference: inv.order.reference,
    totalKobo: inv.order.amountKobo,
    pdf,
  });
  if (!ok) return { message: `The invoice is saved, but the email couldn't be sent — ${lastMailError ?? "unknown error"}. You can download the PDF and send it manually.` };

  await db.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", sentAt: new Date(), sentTo: inv.order.customerEmail, sendCount: { increment: 1 } } });
  await audit(adminId, inv.sendCount ? "invoice.resend" : "invoice.send", inv.number, inv.order.customerEmail);
  revalidatePath(`/admin/orders/${inv.orderId}`);
  return { ok: true, message: `Invoice ${inv.number} sent to ${inv.order.customerEmail}.` };
}
