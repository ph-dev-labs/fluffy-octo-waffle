import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { bookingPath } from "@/lib/haulage/payments";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { HaulagePaidBadge, HaulageStatusBadge, PaymentBadge } from "@/components/admin/badges";
import { Card } from "@/components/admin/ui";
import { HaulageJobForms } from "@/components/admin/forms/HaulageForms";

export const metadata = { title: "Truck booking" };

const KIND: Record<string, string> = { FULL: "Full payment", DEPOSIT: "Deposit", BALANCE: "Balance" };
const dir = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default async function HaulageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await db.haulageRequest.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: "asc" } } } });
  if (!r) notFound();
  const auditTrail = await db.auditLog.findMany({ where: { target: r.reference }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } });
  const outstanding = Math.max(0, r.totalKobo - r.paidKobo);
  const route = `https://www.google.com/maps/dir/?api=1&origin=${r.pickupLat},${r.pickupLng}&destination=${r.dropoffLat},${r.dropoffLng}&travelmode=driving`;

  return (
    <>
      <Link href="/admin/haulage" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Truck hire</Link>
      <AdminHeader
        title={r.reference}
        description={`Booked ${r.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`}
        actions={
          <div className="flex items-center gap-2">
            <HaulageStatusBadge status={r.status} />
            <HaulagePaidBadge total={r.totalKobo} paid={r.paidKobo} />
          </div>
        }
      />

      {r.needsReview ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-danger-100 p-4 text-sm text-danger-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div><p className="font-semibold">Needs review</p><p>{r.reviewNote}</p></div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Route">
            <div className="space-y-4 text-sm">
              {[
                { l: "Pickup", a: r.pickupAddress, s: r.pickupState, lat: r.pickupLat, lng: r.pickupLng },
                { l: "Drop-off", a: r.dropoffAddress, s: r.dropoffState, lat: r.dropoffLat, lng: r.dropoffLng },
              ].map((p) => (
                <div key={p.l} className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">{p.l}{p.s ? ` · ${p.s}` : ""}</p>
                    <p>{p.a}</p>
                    <p className="font-mono text-xs text-ink-400">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p>
                  </div>
                  <a href={dir(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-ink-200 hover:bg-ink-50"><Navigation className="size-3.5" /> Directions</a>
                </div>
              ))}
              <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-brand-600"><Navigation className="size-4" /> Full route in Google Maps</a>
            </div>
          </Card>

          <Card title="Job details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[150px_1fr]">
              <dt className="text-ink-500">Containers</dt><dd>{r.containerCount} × {r.containerSize}</dd>
              <dt className="text-ink-500">Container no(s).</dt><dd className="font-mono">{r.containerNumbers || "—"}</dd>
              <dt className="text-ink-500">Preferred date</dt><dd>{r.preferredDate ? r.preferredDate.toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</dd>
              <dt className="text-ink-500">Distance</dt><dd>{Math.round(r.distanceKm)} km {r.priceMethod === "ESTIMATE" ? "(estimate)" : "(road)"}</dd>
              <dt className="text-ink-500">Price</dt><dd>{formatNaira(r.perContainerKobo)} × {r.containerCount} = <strong>{formatNaira(r.totalKobo)}</strong></dd>
              <dt className="text-ink-500">Customer notes</dt><dd className="whitespace-pre-wrap">{r.notes || "—"}</dd>
            </dl>
          </Card>

          <Card title="Payments">
            <dl className="mb-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-500">Total</dt><dd className="font-semibold tabular-nums">{formatNaira(r.totalKobo)}</dd></div>
              <div className="rounded-xl bg-success-100 p-3"><dt className="text-xs text-success-600">Paid</dt><dd className="font-semibold tabular-nums">{formatNaira(r.paidKobo)}</dd></div>
              <div className="rounded-xl bg-warning-100 p-3"><dt className="text-xs text-warning-600">Outstanding</dt><dd className="font-semibold tabular-nums">{formatNaira(outstanding)}</dd></div>
            </dl>
            <ul className="divide-y divide-ink-100 text-sm">
              {r.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    {KIND[p.kind] ?? p.kind} · <span className="font-mono text-xs">{p.reference}</span>
                    <span className="block text-xs text-ink-400">{(p.paidAt ?? p.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}{p.channel ? ` · ${p.channel}` : ""}{p.reviewNote ? ` · ${p.reviewNote}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2"><span className="font-semibold tabular-nums">{formatNaira(p.amountKobo)}</span><PaymentBadge status={p.status} /></span>
                </li>
              ))}
              {!r.payments.length ? <li className="py-3 text-ink-500">No payment attempts yet.</li> : null}
            </ul>
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
              <li className="font-semibold">{r.customerName}</li>
              {r.companyName ? <li className="flex gap-2"><Building2 className="size-4 text-ink-400" />{r.companyName}</li> : null}
              <li className="flex gap-2"><Mail className="size-4 text-ink-400" /><a href={`mailto:${r.customerEmail}`} className="text-brand-600 hover:underline">{r.customerEmail}</a></li>
              <li className="flex gap-2"><Phone className="size-4 text-ink-400" /><a href={`tel:${r.customerPhone}`} className="text-brand-600 hover:underline">{r.customerPhone}</a></li>
              <li><a href={bookingPath(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900"><ExternalLink className="size-3.5" /> Open the customer&apos;s booking page</a></li>
            </ul>
          </Card>
          <HaulageJobForms
            job={{
              id: r.id,
              status: r.status,
              scheduledFor: r.scheduledFor?.toISOString() ?? null,
              driverName: r.driverName,
              driverPhone: r.driverPhone,
              truckPlate: r.truckPlate,
              adminNote: r.adminNote,
              needsReview: r.needsReview,
              outstandingKobo: outstanding,
              hasOpenPayments: r.payments.some((p) => ["PENDING", "FAILED", "ABANDONED"].includes(p.status) && p.paystackAccessCode),
            }}
          />
        </div>
      </div>
    </>
  );
}
