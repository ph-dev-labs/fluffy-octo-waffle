import { notFound } from "next/navigation";
import { AlertTriangle, Mail, MapPin, Phone, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import { OrderActions, ResolveReviewForm } from "@/components/admin/forms/OrderForms";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  const events = await db.paymentEvent.findMany({ where: { reference: o.reference }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, type: true, createdAt: true } });
  const auditTrail = await db.auditLog.findMany({ where: { target: o.reference }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } });

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
              <div className="flex justify-between"><dt className="text-ink-500">Delivery{o.deliveryZone ? ` (${o.deliveryZone})` : ""}</dt><dd className="tabular-nums">{formatNaira(o.deliveryKobo)}</dd></div>
              <div className="flex justify-between pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatNaira(o.amountKobo)}</dd></div>
            </dl>
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
          <OrderActions id={o.id} status={o.status} fulfilmentStatus={o.fulfilmentStatus} adminNote={o.adminNote ?? ""} />
        </div>
      </div>
    </>
  );
}
