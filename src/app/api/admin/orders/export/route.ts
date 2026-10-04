import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/session";
import { buildOrderWhere } from "@/lib/admin/order-filters";

export const runtime = "nodejs";

/** Neutralise spreadsheet formula injection (=, +, -, @) and quote every cell. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return new NextResponse("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const orders = await db.order.findMany({ where: buildOrderWhere(sp), orderBy: { createdAt: "desc" }, take: 10_000, include: { items: true } });

  const header = ["reference", "created", "paid_at", "status", "fulfilment_status", "customer", "email", "phone", "company", "fulfilment", "delivery_zone", "delivery_address", "items", "subtotal_ngn", "delivery_ngn", "total_ngn", "channel", "needs_review"];
  const rows = orders.map((o) =>
    [
      o.reference, o.createdAt, o.paidAt, o.status, o.fulfilmentStatus, o.customerName, o.customerEmail, o.customerPhone, o.companyName, o.fulfilment, o.deliveryZone, o.deliveryAddress,
      o.items.map((i) => `${i.quantity}x ${i.title}`).join("; "), o.subtotalKobo / 100, o.deliveryKobo / 100, o.amountKobo / 100, o.channel, o.needsReview,
    ].map(cell).join(","),
  );

  await audit(user.id, "order.export", null, `${orders.length} rows`);
  return new NextResponse([header.join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
