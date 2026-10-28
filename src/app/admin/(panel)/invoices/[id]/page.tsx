import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { dateInputValue, invoiceStockOptions, manualTotals, parseLines } from "@/lib/invoice/service";
import { formatContainerNumber } from "@/lib/container-number";
import { formatNaira } from "@/lib/money";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { ManualInvoicePanel } from "@/components/admin/forms/ManualInvoicePanel";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sendFailed?: string }> }) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) notFound();
  // Order invoices are managed on their order.
  if (inv.orderId) redirect(`/admin/orders/${inv.orderId}`);

  const lines = parseLines(inv.lines);
  const totals = manualTotals(lines, inv.deliveryKobo ?? 0);
  const stock = await invoiceStockOptions();

  return (
    <>
      <AdminHeader title={`Invoice ${inv.number}`} description={inv.companyName ? `${inv.customerName} · ${inv.companyName}` : inv.customerName ?? undefined} back={{ href: "/admin/invoices", label: "Invoices" }} />

      {sp.sendFailed && inv.status !== "SENT" ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> The invoice was saved, but the email couldn&apos;t be sent. Try &quot;Send to client&quot; again, or download the PDF and send it yourself.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <ManualInvoicePanel
            invoice={{ id: inv.id, number: inv.number, status: inv.status, sentAt: inv.sentAt?.toISOString() ?? null, sentTo: inv.sentTo, sendCount: inv.sendCount, paidAt: inv.paidAt?.toISOString() ?? null, totalLabel: formatNaira(totals.totalKobo) }}
            stock={stock}
            values={{
              customerName: inv.customerName ?? "",
              companyName: inv.companyName ?? "",
              customerEmail: inv.customerEmail ?? "",
              customerPhone: inv.customerPhone ?? "",
              customerAddress: inv.customerAddress ?? "",
              deliveryAddress: inv.deliveryAddress ?? "",
              deliveryNaira: String((inv.deliveryKobo ?? 0) / 100),
              dueDate: inv.dueAt ? dateInputValue(inv.dueAt) : "",
              note: inv.note ?? "",
              quoteRequestId: inv.quoteRequestId ?? "",
              lines: lines.map((l) => ({ description: l.description, containerNumber: l.containerNumber, quantity: String(l.quantity), unitPriceNaira: String(l.unitPriceKobo / 100) })),
            }}
          />

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-ink-100 text-left text-xs font-semibold tracking-wider text-ink-500 uppercase">
                <tr>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Container no.</th>
                  <th className="py-2 pr-3 text-center">Qty</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-3">{l.description}</td>
                    <td className="py-2.5 pr-3 font-mono text-[#192440]">{l.containerNumber ? formatContainerNumber(l.containerNumber) : "—"}</td>
                    <td className="py-2.5 pr-3 text-center">{l.quantity}</td>
                    <td className="py-2.5 text-right">{formatNaira(l.unitPriceKobo * l.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr><td colSpan={3} className="pt-3 text-right text-ink-500">Subtotal</td><td className="pt-3 text-right">{formatNaira(totals.subtotalKobo)}</td></tr>
                <tr><td colSpan={3} className="text-right text-ink-500">Delivery</td><td className="text-right">{formatNaira(totals.deliveryKobo)}</td></tr>
                <tr className="font-bold"><td colSpan={3} className="text-right">Total</td><td className="text-right">{formatNaira(totals.totalKobo)}</td></tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Client">
            <dl className="space-y-1 text-sm">
              <dd className="font-semibold">{inv.customerName}</dd>
              {inv.companyName ? <dd>{inv.companyName}</dd> : null}
              <dd><a href={`mailto:${inv.customerEmail}`} className="text-brand-600 hover:underline">{inv.customerEmail}</a></dd>
              <dd><a href={`tel:${inv.customerPhone}`} className="text-brand-600 hover:underline">{inv.customerPhone}</a></dd>
              {inv.customerAddress ? <dd className="text-ink-500">{inv.customerAddress}</dd> : null}
            </dl>
          </Card>
          <Card title="Delivery & terms">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-ink-500">Delivery</dt><dd>{inv.deliveryAddress || "Collection from terminal"}</dd></div>
              <div><dt className="text-ink-500">Payment due</dt><dd>{inv.dueAt ? inv.dueAt.toLocaleDateString("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }) : "—"}</dd></div>
              {inv.quoteRequestId ? <div><dt className="text-ink-500">Source</dt><dd><Link href="/admin/requests?tab=quote&show=all" className="text-brand-600 hover:underline">Quote request</Link></dd></div> : null}
              {inv.note ? <div><dt className="text-ink-500">Note</dt><dd className="whitespace-pre-line">{inv.note}</dd></div> : null}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
