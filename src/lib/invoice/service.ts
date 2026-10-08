import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Invoice, Order, OrderItem } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_DELIVERY_ZONES } from "@/lib/pricing";
import { site } from "@/content/site";
import { InvoiceDocument, type InvoiceData } from "./InvoiceDocument";

export const INVOICEABLE_FULFILMENT = ["DELIVERED", "COLLECTED"] as const;

/** An invoice can only be issued once the order is paid AND the container(s) delivered/collected. */
export function invoiceEligibility(order: Pick<Order, "status" | "fulfilmentStatus">): { ok: true } | { ok: false; reason: string } {
  if (order.status !== "PAID") return { ok: false, reason: "Invoices can only be issued for paid orders." };
  if (!(INVOICEABLE_FULFILMENT as readonly string[]).includes(order.fulfilmentStatus)) {
    return { ok: false, reason: "Mark the order as Delivered or Collected first, then issue the invoice." };
  }
  return { ok: true };
}

/** One row per physical container (a line with quantity 2 becomes two rows, each with its own number). */
export function expandUnits(items: Pick<OrderItem, "title" | "unitPriceKobo" | "quantity">[]) {
  return items.flatMap((i) => Array.from({ length: i.quantity }, (_, k) => ({ title: i.title, unitPriceKobo: i.unitPriceKobo, unitIndex: k + 1, unitsOfItem: i.quantity })));
}

export function formatInvoiceNumber(seq: number, issuedAt: Date) {
  return `INV-${issuedAt.getFullYear()}-${String(seq).padStart(5, "0")}`;
}

export function parseContainerNumbers(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type FullInvoice = Invoice & { order: Order & { items: OrderItem[] } };

export async function loadInvoice(id: string): Promise<FullInvoice | null> {
  return db.invoice.findUnique({ where: { id }, include: { order: { include: { items: true } } } });
}

export async function buildInvoiceData(inv: FullInvoice): Promise<InvoiceData> {
  const o = inv.order;
  const numbers = parseContainerNumbers(inv.containerNumbers);
  const units = expandUnits(o.items);
  const terminals = o.fulfilment === "PICKUP"
    ? (await db.container.findMany({ where: { id: { in: o.items.map((i) => i.containerId) } }, select: { terminal: true } })).map((c) => c.terminal)
    : [];
  const zoneLabel = o.deliveryState
    ? [o.deliveryArea, o.deliveryState].filter(Boolean).join(", ")
    : o.deliveryZone
    ? (await db.deliveryZone.findUnique({ where: { code: o.deliveryZone }, select: { label: true } }))?.label ??
      DEFAULT_DELIVERY_ZONES[o.deliveryZone as keyof typeof DEFAULT_DELIVERY_ZONES]?.label ??
      o.deliveryZone
    : null;

  return {
    number: inv.number,
    issuedAt: inv.issuedAt,
    status: inv.status === "SENT" ? "SENT" : "DRAFT",
    company: {
      legalName: site.legalName,
      address: site.address,
      phone: site.phone,
      email: site.email,
      website: (process.env.APP_URL ?? "https://c-zuchigrp.com").replace(/^https?:\/\//, ""),
      rcNumber: site.rcNumber || undefined,
    },
    customer: { name: o.customerName, company: o.companyName, email: o.customerEmail, phone: o.customerPhone },
    fulfilment: { method: o.fulfilment === "DELIVERY" ? "DELIVERY" : "PICKUP", address: o.deliveryAddress, zone: zoneLabel, terminals: [...new Set(terminals)] },
    order: { reference: o.reference, paidAt: o.paidAt, channel: o.channel, paystackId: o.paystackTransactionId },
    lines: units.map((u, idx) => ({
      description: u.unitsOfItem > 1 ? `${u.title} (unit ${u.unitIndex} of ${u.unitsOfItem})` : u.title,
      containerNumber: numbers[idx] ?? "",
      unitPriceKobo: u.unitPriceKobo,
    })),
    subtotalKobo: o.subtotalKobo,
    deliveryKobo: o.deliveryKobo,
    totalKobo: o.amountKobo,
    note: inv.note,
  };
}

export async function renderInvoicePdf(inv: FullInvoice): Promise<Buffer> {
  const data = await buildInvoiceData(inv);
  return renderToBuffer(createElement(InvoiceDocument, { data }) as Parameters<typeof renderToBuffer>[0]);
}
