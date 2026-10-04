import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { FulfilmentBadge, PaymentBadge } from "@/components/admin/badges";
import { cn } from "@/lib/utils";
import { buildOrderWhere, ORDER_FILTER_STATUSES as STATUSES, type OrderFilters as SP } from "@/lib/admin/order-filters";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 25;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = buildOrderWhere(sp);
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { items: true } } } }),
    db.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `?${p.toString()}`;
  };

  return (
    <>
      <AdminHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}`}
        actions={
          <a href={`/api/admin/orders/export${qs({ page: undefined })}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-ink-900/5">
          {STATUSES.map((s) => {
            const active = (sp.status ?? "ALL") === s;
            return (
              <Link key={s} href={qs({ status: s === "ALL" ? undefined : s, page: undefined })} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap", active ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-900")}>
                {s.replace("_", " ").toLowerCase()}
              </Link>
            );
          })}
        </div>
        <Link href={qs({ review: sp.review === "1" ? undefined : "1", page: undefined })} className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold", sp.review === "1" ? "bg-danger-600 text-white" : "bg-white text-danger-600 ring-1 ring-ink-900/5")}>
          <AlertTriangle className="size-3.5" /> Needs review
        </Link>
        <form className="lg:ml-auto">
          {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
          <input name="q" defaultValue={sp.q} placeholder="Reference, name, email, phone…" className="h-10 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm outline-none focus:border-brand-500 lg:w-72" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Payment</th>
                <th className="px-3 py-3 font-medium">Fulfilment</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{o.reference}</Link>
                    {o.needsReview ? <AlertTriangle className="ml-2 inline size-3.5 text-danger-600" aria-label="Needs review" /> : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block">{o.customerName}</span>
                    <span className="block text-xs text-ink-500">{o.customerEmail}</span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatNaira(o.amountKobo)}<span className="block text-xs text-ink-400">{o._count.items} item{o._count.items === 1 ? "" : "s"} · {o.fulfilment.toLowerCase()}</span></td>
                  <td className="px-3 py-3"><PaymentBadge status={o.status} /></td>
                  <td className="px-3 py-3"><FulfilmentBadge status={o.fulfilmentStatus} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-500">{o.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
              {!orders.length ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-500">No orders match these filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-ink-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-ink-200 hover:bg-ink-50">Previous</Link> : null}
            {page < pages ? <Link href={qs({ page: String(page + 1) })} className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-ink-200 hover:bg-ink-50">Next</Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
