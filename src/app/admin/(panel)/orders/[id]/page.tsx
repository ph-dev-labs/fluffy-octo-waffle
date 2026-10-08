import { notFound } from "next/navigation";
import { AlertTriangle, Mail, MapPin, Phone, Building2, Navigation } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import { OrderActions, ResolveReviewForm } from "@/components/admin/forms/OrderForms";
import { InvoicePanel } from "@/components/admin/forms/InvoicePanel";
import { expandUnits, invoiceEligibility, parseContainerNumbers } from "@/lib/invoice/service";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { items: true, invoice: true } });
  if (!o) notFound();
  const events = await db.paymentEvent.findMany({ where: { reference: o.reference }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, createdAt: true } });
  const auditTrail = await db.auditLog.findMany({ where: { target: o.reference }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } });

  const units = expandUnits(o.items).map((u) => ({ label: u.unitsOfItem > 1 ? `${u.title} — unit ${u.unitIndex} of ${u.unitsOfItem}` : u.title }));
  const invoice = o.invoice
    ? {
        id: o.invoice.id,
        number: o.invoice.number,
        status: o.invoice.status,
        sentAt: o.invoice.sentAt?.toISOString() ?? null,
        sentTo: o.invoice.sentTo,
        sendCount: o.invoice.sendCount,
        containerNumbers: parseContainerNumbers(o.invoice.containerNumbers),
        note: o.invoice.note,
      }
    : null;

  const rows: [string, React.ReactNode][] = [
    ["Created", o.createdAt.toLocaleString("en-NG")],
    ["Paid at", o.paidAt?.toLocaleString("en-NG") ?? "—"],
    ["Channel", o.channel ?? "—"],
    ["Gateway response", o.gatewayResponse ?? "—"],
    ["Paystack transaction", o.paystackTransactionId ?? "—"],
    ["Verification checks", `${o.verifyAttempts}${o.lastVerifiedAt ? ` · last ${o.lastVerifiedAt.toLocaleString("en-NG")}` : ""}`],
    ["Receipt email", o.receiptSentAt ? `Sent ${o.receiptSentAt.toLocaleString("en-NG")}` : "Not sent"],
  ];

  return (
    <>
      <AdminHeader
        title={o.reference}
        description={`${o.customerName} · ${formatNaira(o.amountKobo)}`}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <div className="flex items-center gap-2">
            <PaymentBadge status={o.status} />
            <FulfilmentBadge status={o.fulfilmentStatus} />
          </div>
        }
      />

      {o.needsReview ? (
        <Card className="mb-6 bg-danger-100/60 ring-danger-600/20">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-danger-600">This order needs review</p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-700">{o.reviewNote}</p>
              <div className="mt-4"><ResolveReviewForm id={o.id} /></div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-ink-100 text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-3">
                  <span>{i.quantity} × {i.title}<span className="block text-xs text-ink-400">{formatNaira(i.unitPriceKobo)} each (price at purchase)</span></span>
                  <span className="font-semibold tabular-nums">{formatNaira(i.unitPriceKobo * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-ink-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{formatNaira(o.subtotalKobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Delivery{o.deliveryState ? ` (${[o.deliveryArea, o.deliveryState].filter(Boolean).join(", ")})` : o.deliveryZone ? ` (${o.deliveryZone})` : ""}</dt><dd className="tabular-nums">{formatNaira(o.deliveryKobo)}</dd></div>
              <div className="flex justify-between pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatNaira(o.amountKobo)}</dd></div>
            </dl>
          </Card>

          <Card title="Invoice">
            <InvoicePanel orderId={o.id} customerEmail={o.customerEmail} eligibility={invoiceEligibility(o)} units={units} invoice={invoice} />
          </Card>

          <Card title="Payment">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
            {events.length ? (
              <div className="mt-4 border-t border-ink-100 pt-3">
                <p className="mb-2 text-xs font-semibold text-ink-500">Webhook events</p>
                <ul className="space-y-1 text-xs text-ink-600">
                  {events.map((e) => <li key={e.id}><code>{e.type}</code> · {e.createdAt.toLocaleString("en-NG")}</li>)}
                </ul>
              </div>
            ) : null}
          </Card>

          {auditTrail.length ? (
            <Card title="Admin activity">
              <ul className="space-y-2 text-sm">
                {auditTrail.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span><span className="font-medium">{a.user?.name ?? "System"}</span> · {a.action}{a.detail ? <span className="text-ink-500"> — {a.detail}</span> : null}</span>
                    <span className="shrink-0 text-xs text-ink-400">{a.createdAt.toLocaleString("en-NG")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <ul className="space-y-3 text-sm">
              <li className="font-semibold">{o.customerName}</li>
              {o.companyName ? <li className="flex gap-2"><Building2 className="size-4 text-ink-400" />{o.companyName}</li> : null}
              <li className="flex gap-2"><Mail className="size-4 text-ink-400" /><a href={`mailto:${o.customerEmail}`} className="text-brand-600 hover:underline">{o.customerEmail}</a></li>
              <li className="flex gap-2"><Phone className="size-4 text-ink-400" /><a href={`tel:${o.customerPhone}`} className="text-brand-600 hover:underline">{o.customerPhone}</a></li>
              <li className="flex gap-2"><MapPin className="size-4 shrink-0 text-ink-400" />{o.fulfilment === "DELIVERY" ? o.deliveryAddress : "Pickup at terminal"}</li>
            </ul>
          </Card>
          {o.fulfilment === "DELIVERY" && o.deliveryLat != null && o.deliveryLng != null ? (
            <Card title="Delivery location">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Place</dt><dd className="text-right">{[o.deliveryArea, o.deliveryState].filter(Boolean).join(", ") || "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Priced by</dt><dd className="text-right">{METHOD_LABEL[o.deliveryMethod ?? ""] ?? o.deliveryMethod ?? "—"}</dd></div>
                {o.deliveryDistanceKm != null ? <div className="flex justify-between gap-3"><dt className="text-ink-500">Distance</dt><dd className="text-right">{Math.round(o.deliveryDistanceKm)} km from {o.deliveryYard ?? "yard"}</dd></div> : null}
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Pin</dt><dd className="font-mono text-xs">{o.deliveryLat.toFixed(5)}, {o.deliveryLng.toFixed(5)}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLat},${o.deliveryLng}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-brand-600">
                  <Navigation className="size-4" /> Directions (Google Maps)
                </a>
                <a href={`https://www.openstreetmap.org/?mlat=${o.deliveryLat}&mlon=${o.deliveryLng}#map=17/${o.deliveryLat}/${o.deliveryLng}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
                  View on map
                </a>
              </div>
            </Card>
          ) : null}
          <OrderActions id={o.id} status={o.status} fulfilmentStatus={o.fulfilmentStatus} adminNote={o.adminNote ?? ""} />
        </div>
      </div>
    </>
  );
}

const METHOD_LABEL: Record<string, string> = {
  AREA: "Fixed area rate",
  STATE: "Fixed state rate",
  DISTANCE: "Road distance",
  ESTIMATE: "Distance estimate",
};
