import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Banknote, Boxes, ClipboardList, Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";

export const metadata = { title: "Dashboard" };

const DAY = 86_400_000;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireAdmin();
  const { denied } = await searchParams;
  const since30 = new Date(Date.now() - 30 * DAY);
  const since14 = new Date(new Date().setHours(0, 0, 0, 0) - 13 * DAY);

  const [revenue30, paid30, pending, review, toFulfil, lowStock, recent, last14, newRequests] = await Promise.all([
    db.order.aggregate({ _sum: { amountKobo: true }, where: { status: "PAID", paidAt: { gte: since30 } } }),
    db.order.count({ where: { status: "PAID", paidAt: { gte: since30 } } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { needsReview: true } }),
    db.order.count({ where: { status: "PAID", fulfilmentStatus: { in: ["UNFULFILLED", "PROCESSING"] } } }),
    db.container.findMany({ where: { active: true, stock: { lte: 1 } }, orderBy: { stock: "asc" }, take: 6, select: { id: true, title: true, stock: true } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, reference: true, customerName: true, amountKobo: true, status: true, fulfilmentStatus: true, createdAt: true } }),
    db.order.findMany({ where: { status: "PAID", paidAt: { gte: since14 } }, select: { paidAt: true, amountKobo: true } }),
    Promise.all([db.quoteRequest.count({ where: { status: "NEW" } }), db.inspectionRequest.count({ where: { status: "NEW" } }), db.contactMessage.count({ where: { status: "NEW" } })]),
  ]);

  // 14-day revenue series
  const days = Array.from({ length: 14 }, (_, i) => {
    const start = since14.getTime() + i * DAY;
    const total = last14.filter((o) => o.paidAt && o.paidAt.getTime() >= start && o.paidAt.getTime() < start + DAY).reduce((s, o) => s + o.amountKobo, 0);
    return { label: new Date(start).toLocaleDateString("en-NG", { day: "numeric", month: "short" }), total };
  });
  const max = Math.max(1, ...days.map((d) => d.total));

  const stats = [
    { label: "Revenue (30 days)", value: formatNaira(revenue30._sum.amountKobo ?? 0), sub: `${paid30} paid orders`, icon: Banknote, href: "/admin/orders?status=PAID" },
    { label: "To fulfil", value: toFulfil, sub: "Paid, not yet dispatched", icon: ClipboardList, href: "/admin/orders?status=PAID&fulfilment=open" },
    { label: "Awaiting payment", value: pending, sub: "Pending at Paystack", icon: Boxes, href: "/admin/orders?status=PENDING" },
    { label: "New requests", value: newRequests.reduce((a, b) => a + b, 0), sub: `${newRequests[0]} quotes · ${newRequests[1]} inspections · ${newRequests[2]} messages`, icon: Inbox, href: "/admin/requests" },
  ];

  return (
    <>
      <AdminHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here's what's happening in the store." />
      {denied ? <p className="mb-6 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">That page is only available to the owner account.</p> : null}

      {review ? (
        <Link href="/admin/orders?review=1" className="mb-6 flex items-center gap-3 rounded-2xl bg-danger-100 p-4 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-100/70">
          <AlertTriangle className="size-5" />
          {review} order{review === 1 ? " needs" : "s need"} review (amount mismatch, stock conflict or reversal).
          <ArrowUpRight className="ml-auto size-4" />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-2xl bg-white p-5 ring-1 ring-ink-900/5 transition-shadow hover:shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-500">{label}</p>
              <Icon className="size-4 text-ink-400 transition-colors group-hover:text-brand-600" />
            </div>
            <p className="font-display mt-3 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 truncate text-xs text-ink-400">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Revenue — last 14 days">
          <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Daily paid revenue for the last 14 days">
            {days.map((d) => (
              <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t-md bg-brand-500/80 transition-colors group-hover:bg-brand-600" style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }} />
                <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-ink-900 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                  {d.label}: {formatNaira(d.total)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-400">
            <span>{days[0].label}</span>
            <span>{days[13].label}</span>
          </div>
        </Card>

        <Card title="Low stock" action={<Link href="/admin/containers" className="text-xs font-medium text-brand-600 hover:underline">Manage</Link>}>
          {lowStock.length ? (
            <ul className="divide-y divide-ink-100">
              {lowStock.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <Link href={`/admin/containers/${c.id}`} className="truncate hover:text-brand-600">{c.title}</Link>
                  <span className={c.stock === 0 ? "font-semibold text-danger-600" : "text-warning-600"}>{c.stock === 0 ? "Sold out" : `${c.stock} left`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">All active listings are well stocked.</p>
          )}
        </Card>
      </div>

      <Card title="Recent orders" className="mt-6" action={<Link href="/admin/orders" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}>
        <OrdersMiniTable orders={recent} />
      </Card>
    </>
  );
}

function OrdersMiniTable({ orders }: { orders: { id: string; reference: string; customerName: string; amountKobo: number; status: string; fulfilmentStatus: string; createdAt: Date }[] }) {
  if (!orders.length) return <p className="text-sm text-ink-500">No orders yet.</p>;
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-ink-400">
          <tr>
            <th className="px-5 py-2 font-medium sm:px-6">Reference</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Payment</th>
            <th className="px-3 py-2 font-medium">Fulfilment</th>
            <th className="px-5 py-2 font-medium sm:px-6">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-ink-50">
              <td className="px-5 py-3 sm:px-6"><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{o.reference}</Link></td>
              <td className="px-3 py-3">{o.customerName}</td>
              <td className="px-3 py-3 tabular-nums">{formatNaira(o.amountKobo)}</td>
              <td className="px-3 py-3"><PaymentBadge status={o.status} /></td>
              <td className="px-3 py-3"><FulfilmentBadge status={o.fulfilmentStatus} /></td>
              <td className="px-5 py-3 text-ink-500 sm:px-6">{o.createdAt.toLocaleDateString("en-NG")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
