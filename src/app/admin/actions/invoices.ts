"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { checkContainerNumber } from "@/lib/container-number";
import { logger } from "@/lib/logger";
import { lastMailError, sendInvoiceEmail } from "@/lib/mail";
import { expandUnits, formatInvoiceNumber, invoiceEligibility, invoiceRecipient, loadInvoice, parseContainerNumbers, renderInvoicePdf, type InvoiceLine } from "@/lib/invoice/service";
import { fieldErrors } from "@/lib/validation";
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
  if (inv.order) {
    const eligible = invoiceEligibility(inv.order);
    if (!eligible.ok) return { message: eligible.reason };
  }
  const to = invoiceRecipient(inv);

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
    to: to.email,
    customerName: to.name,
    invoiceNumber: inv.number,
    orderReference: inv.order?.reference ?? null,
    totalKobo: to.totalKobo,
    paid: !!(inv.order?.paidAt ?? inv.paidAt),
    dueAt: inv.dueAt,
    pdf,
  });
  if (!ok) return { message: `The invoice is saved, but the email couldn't be sent — ${lastMailError ?? "unknown error"}. You can download the PDF and send it manually.` };

  await db.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", sentAt: new Date(), sentTo: to.email, sendCount: { increment: 1 } } });
  // Answering a quote request with an invoice handles it.
  if (inv.quoteRequestId) await db.quoteRequest.update({ where: { id: inv.quoteRequestId }, data: { status: "HANDLED" } });
  await audit(adminId, inv.sendCount ? "invoice.resend" : "invoice.send", inv.number, to.email);
  revalidatePath(inv.orderId ? `/admin/orders/${inv.orderId}` : `/admin/invoices/${inv.id}`);
  revalidatePath("/admin/invoices");
  return { ok: true, message: `Invoice ${inv.number} sent to ${to.email}.` };
}

// ── Admin-raised invoices (no website order, e.g. answering a quote request) ──

const naira = (label: string) => z.coerce.number(`Enter ${label}`).min(0, `${label} can't be negative`).max(10_000_000_000);
const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const lineSchema = z.object({
  description: z.string().trim().min(3, "Describe the container").max(200),
  containerNumber: z.string().trim().max(20).transform((v, ctx) => {
    if (!v) return "";
    // Format only: the check digit is shown as a warning in the form, since the admin may be
    // copying a number straight off the door.
    const r = checkContainerNumber(v, { skipCheckDigit: true });
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.message });
    return r.value;
  }),
  quantity: z.coerce.number("Enter a quantity").int("Whole containers only").min(1, "At least 1").max(500),
  unitPriceNaira: naira("a price").refine((v) => v > 0, "Price must be greater than 0"),
});

const manualSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the client's name").max(120),
  companyName: optional(160),
  customerEmail: z.email("Enter a valid email").trim().toLowerCase().max(200),
  customerPhone: z.string().trim().min(7, "Enter a phone number").max(40),
  customerAddress: optional(300),
  deliveryAddress: optional(300),
  deliveryNaira: naira("the delivery cost"),
  dueDate: z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(`${v}T23:59:59+01:00`); // end of that day, Lagos time
    if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "Pick a valid date" });
    return d;
  }),
  note: optional(1000),
  quoteRequestId: optional(40),
  lines: z.string().transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid line items" });
      return z.NEVER;
    }
  }).pipe(z.array(lineSchema).min(1, "Add at least one container").max(50)),
});

/**
 * Creates (invoiceId = null) or updates an admin-raised invoice, then (intent = "send")
 * emails the PDF to the client. New invoices land on their own page.
 */
export async function saveManualInvoiceAction(invoiceId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = manualSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  const intent = fd.get("intent") === "send" ? "send" : "draft";

  const lines: InvoiceLine[] = v.lines.map((l) => ({ description: l.description, containerNumber: l.containerNumber, quantity: l.quantity, unitPriceKobo: Math.round(l.unitPriceNaira * 100) }));
  const data = {
    customerName: v.customerName,
    companyName: v.companyName,
    customerEmail: v.customerEmail,
    customerPhone: v.customerPhone,
    customerAddress: v.customerAddress,
    deliveryAddress: v.deliveryAddress,
    deliveryKobo: Math.round(v.deliveryNaira * 100),
    dueAt: v.dueDate,
    note: v.note,
    lines: JSON.stringify(lines),
  };

  let id = invoiceId;
  if (id) {
    const existing = await db.invoice.findUnique({ where: { id }, select: { number: true, orderId: true } });
    if (!existing || existing.orderId) return { message: "Invoice not found." };
    await db.invoice.update({ where: { id }, data });
    await audit(admin.id, "invoice.update", existing.number, `${v.customerName} · ${lines.length} line(s)`);
  } else {
    const quoteRequestId = v.quoteRequestId && (await db.quoteRequest.count({ where: { id: v.quoteRequestId } })) ? v.quoteRequestId : null;
    // Two steps so the human-readable number comes from the DB sequence (shared with order invoices).
    const created = await db.$transaction(async (trx) => {
      const draft = await trx.invoice.create({ data: { ...data, number: `PENDING-${crypto.randomUUID()}`, containerNumbers: "[]", quoteRequestId, createdById: admin.id } });
      return trx.invoice.update({ where: { id: draft.id }, data: { number: formatInvoiceNumber(draft.seq, draft.issuedAt) } });
    });
    id = created.id;
    await audit(admin.id, "invoice.create", created.number, `${v.customerName}${quoteRequestId ? " (from quote request)" : ""}`);
  }

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  const result = intent === "send" ? await sendInvoice(id, admin.id) : { ok: true, message: "Invoice saved as a draft. Preview it, then send it to the client." };
  // A new invoice moves to its own page (the result still shows there via the toast on revisit).
  if (!invoiceId) redirect(`/admin/invoices/${id}?${result.ok ? (intent === "send" ? "sent=1" : "saved=1") : "sendFailed=1"}`);
  return result;
}

/** Records (or clears) payment for an admin-raised invoice — e.g. once the bank transfer lands. */
export async function setInvoicePaidAction(invoiceId: string, paid: boolean) {
  const admin = await requireAdmin();
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, select: { number: true, orderId: true } });
  if (!inv || inv.orderId) return;
  await db.invoice.update({ where: { id: invoiceId }, data: { paidAt: paid ? new Date() : null } });
  await audit(admin.id, paid ? "invoice.paid" : "invoice.unpaid", inv.number);
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
}
