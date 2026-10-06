import "server-only";
import { db } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import { formatNaira } from "./money";

// Transactional email via Resend (https://resend.com) — plain HTTPS API, no SDK.
// If RESEND_API_KEY is not set, emails are logged and skipped so nothing else breaks.

interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Base64-encoded file attachments (e.g. invoice PDFs). */
  attachments?: { filename: string; content: string }[];
}

export async function sendMail(mail: Mail): Promise<boolean> {
  const { RESEND_API_KEY: key, MAIL_FROM: from } = env();
  if (!key || !from) {
    logger.warn("mail.not_configured", { subject: mail.subject });
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo, attachments: mail.attachments }),
      signal: AbortSignal.timeout(mail.attachments?.length ? 30_000 : 10_000),
    });
    if (!res.ok) {
      logger.error("mail.send_failed", { subject: mail.subject, status: res.status, body: (await res.text()).slice(0, 300) });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("mail.send_error", { subject: mail.subject, error: err });
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#0a1128">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0a1128;padding:20px 28px;color:#fff;font-size:20px;font-weight:bold">C<span style="color:#ff6b2c">-</span>ZUCHI</td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 28px;background:#f6f8fc;color:#8a93ad;font-size:12px">C-ZUCHI Group · Shipping Container Marketplace</td></tr>
</table></td></tr></table></body></html>`;
}

const ops = () => env().MAIL_ADMIN_TO?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

/**
 * Sends the receipt + ops alert exactly once per paid order. The send is
 * "claimed" with a conditional update first, so concurrent webhook/poller/cron
 * calls can't double-send; on failure the claim is released for the cron to retry.
 */
export async function notifyOrderPaid(orderId: string) {
  const claim = await db.order.updateMany({ where: { id: orderId, status: "PAID", receiptSentAt: null }, data: { receiptSentAt: new Date() } });
  if (claim.count !== 1) return;

  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const rows = o.items
    .map((i) => `<tr><td style="padding:6px 0">${i.quantity} × ${esc(i.title)}</td><td align="right">${formatNaira(i.unitPriceKobo * i.quantity)}</td></tr>`)
    .join("");
  const table = `<table width="100%" style="font-size:14px;border-collapse:collapse">${rows}
${o.deliveryKobo ? `<tr><td style="padding:6px 0">Delivery</td><td align="right">${formatNaira(o.deliveryKobo)}</td></tr>` : ""}
<tr><td style="padding:10px 0;border-top:1px solid #dde2ec;font-weight:bold">Total paid</td><td align="right" style="border-top:1px solid #dde2ec;font-weight:bold">${formatNaira(o.amountKobo)}</td></tr></table>`;
  const fulfil = o.fulfilment === "DELIVERY" ? `Delivery to: ${esc(o.deliveryAddress ?? "")}` : "Pickup at terminal";

  const customer = await sendMail({
    to: o.customerEmail,
    subject: `Payment received — order ${o.reference}`,
    html: layout(`Thank you, ${o.customerName.split(" ")[0]}!`, `<p style="font-size:14px;line-height:1.6">We've received your payment. Our team will contact you shortly to arrange ${o.fulfilment === "DELIVERY" ? "delivery" : "pickup"}.</p>${table}<p style="font-size:13px;color:#5a6688">${fulfil}<br>Reference: <b>${o.reference}</b></p>`),
    text: `Payment received for order ${o.reference}. Total: ${formatNaira(o.amountKobo)}. ${o.fulfilment === "DELIVERY" ? "We'll contact you to arrange delivery." : "We'll contact you to arrange pickup."}`,
  });

  if (ops().length) {
    await sendMail({
      to: ops(),
      subject: `💰 New paid order ${o.reference} — ${formatNaira(o.amountKobo)}`,
      html: layout("New paid order", `<p style="font-size:14px">${esc(o.customerName)} · ${esc(o.customerPhone)} · ${esc(o.customerEmail)}</p>${table}<p style="font-size:13px">${fulfil}</p><p><a href="${env().APP_URL}/admin/orders/${o.id}">Open in admin →</a></p>`),
      text: `New paid order ${o.reference} from ${o.customerName} (${o.customerPhone}). Total ${formatNaira(o.amountKobo)}.`,
      replyTo: o.customerEmail,
    });
  }

  if (!customer) await db.order.update({ where: { id: orderId }, data: { receiptSentAt: null } }); // release claim → cron retries
}

/** Internal alert for quote / inspection / contact form submissions. */
export async function notifyOps(subject: string, fields: Record<string, string | null | undefined>, replyTo?: string) {
  if (!ops().length) return;
  const rows = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5a6688;vertical-align:top">${esc(k)}</td><td>${esc(String(v)).replace(/\n/g, "<br>")}</td></tr>`)
    .join("");
  await sendMail({
    to: ops(),
    subject,
    replyTo,
    html: layout(subject, `<table style="font-size:14px">${rows}</table><p><a href="${env().APP_URL}/admin/requests">Open in admin →</a></p>`),
    text: Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n"),
  });
}

/** Emails an invoice PDF to the customer (staff on CC via MAIL_ADMIN_TO). Returns true on success. */
export async function sendInvoiceEmail(opts: { to: string; customerName: string; invoiceNumber: string; orderReference: string; totalKobo: number; pdf: Buffer }) {
  const first = opts.customerName.split(" ")[0];
  return sendMail({
    to: opts.to,
    subject: `Invoice ${opts.invoiceNumber} — C-ZUCHI order ${opts.orderReference}`,
    replyTo: ops()[0],
    html: layout(
      `Your invoice ${opts.invoiceNumber}`,
      `<p style="font-size:14px;line-height:1.6">Hello ${esc(first)},</p>
<p style="font-size:14px;line-height:1.6">Thank you for choosing C-ZUCHI. Your container order has been completed and your invoice is attached as a PDF for your records.</p>
<table style="font-size:14px;margin:16px 0"><tr><td style="color:#5a6688;padding-right:16px">Invoice</td><td><b>${esc(opts.invoiceNumber)}</b></td></tr>
<tr><td style="color:#5a6688;padding-right:16px">Order reference</td><td>${esc(opts.orderReference)}</td></tr>
<tr><td style="color:#5a6688;padding-right:16px">Amount paid</td><td>${formatNaira(opts.totalKobo)}</td></tr></table>
<p style="font-size:13px;color:#5a6688">Questions about this invoice? Simply reply to this email.</p>`,
    ),
    text: `Hello ${first}, your invoice ${opts.invoiceNumber} for order ${opts.orderReference} (${formatNaira(opts.totalKobo)}) is attached. Reply to this email with any questions.`,
    attachments: [{ filename: `${opts.invoiceNumber}.pdf`, content: opts.pdf.toString("base64") }],
  });
}
