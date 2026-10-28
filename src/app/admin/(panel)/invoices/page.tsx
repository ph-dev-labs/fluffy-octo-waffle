import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { invoiceRecipient } from "@/lib/invoice/service";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/admin/badges";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  await requireAdmin();
  const invoices = await db.invoice.findMany({ orderBy: { seq: "desc" }, take: 200, include: { order: true } });

  return (
    <>
      <AdminHeader
        title="Invoices"
        description="Invoices for website orders, and invoices you raise for quote requests or offline sales."
        actions={
          <Link href="/admin/invoices/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            <Plus className="size-4" /> New invoice
          </Link>
        }
      />
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-ink-900/5">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-ink-100 text-left text-xs font-semibold tracking-wider text-ink-500 uppercase">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {invoices.map((inv) => {
              const to = invoiceRecipient(inv);
              const paid = !!(inv.order?.paidAt ?? inv.paidAt);
              const href = inv.orderId ? `/admin/orders/${inv.orderId}` : `/admin/invoices/${inv.id}`;
              return (
                <tr key={inv.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3"><Link href={href} className="font-mono font-semibold text-brand-600 hover:underline">{inv.number}</Link></td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{to.name}</p>
                    <p className="text-xs text-ink-500">{to.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{inv.order ? `Order ${inv.order.reference}` : inv.quoteRequestId ? "Quote request" : "Manual"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatNaira(to.totalKobo)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {inv.status === "SENT" ? <Badge tone="green">sent</Badge> : <Badge tone="amber">draft</Badge>}
                      {paid ? <Badge tone="green">paid</Badge> : <Badge>unpaid</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{inv.issuedAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                </tr>
              );
            })}
            {!invoices.length ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-ink-500">No invoices yet. Raise one from a quote request, or start a new one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
