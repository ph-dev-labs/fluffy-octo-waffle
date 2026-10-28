import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { SIZE_LABELS } from "@/lib/catalog";
import { dateInputValue, invoiceStockOptions } from "@/lib/invoice/service";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Card } from "@/components/admin/ui";
import { EMPTY_LINE, ManualInvoiceForm, type ManualInvoiceValues } from "@/components/admin/forms/ManualInvoiceForm";

export const metadata = { title: "New invoice" };

const PAYMENT_DAYS = 7;

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ quote?: string }> }) {
  await requireAdmin();
  const { quote: quoteId } = await searchParams;
  const [quote, stock] = await Promise.all([quoteId ? db.quoteRequest.findUnique({ where: { id: quoteId } }) : null, invoiceStockOptions()]);

  const initial: ManualInvoiceValues = {
    customerName: quote?.companyName ?? "",
    companyName: "",
    customerEmail: quote?.email ?? "",
    customerPhone: quote?.phone ?? "",
    customerAddress: "",
    deliveryAddress: "",
    deliveryNaira: "0",
    dueDate: dateInputValue(new Date(Date.now() + PAYMENT_DAYS * 86_400_000)),
    note: "",
    quoteRequestId: quote?.id ?? "",
    lines: [quote ? quoteLine(quote, stock) : { ...EMPTY_LINE }],
  };

  return (
    <>
      <AdminHeader
        title="New invoice"
        description={quote ? `For ${quote.companyName}'s quote request. Check the details, set the price, then send.` : "Enter the client, the containers and the delivery cost, then send."}
        back={quote ? { href: "/admin/requests?tab=quote", label: "Requests" } : { href: "/admin/invoices", label: "Invoices" }}
      />
      {quote ? (
        <Card className="mb-6">
          <p className="text-xs font-semibold tracking-wider text-ink-500 uppercase">Quote request</p>
          <p className="mt-1 text-sm">
            {quote.quantity} × {quote.size ? SIZE_LABELS[quote.size] ?? quote.size : "any size"}, {quote.condition.toLowerCase()} · requested {quote.createdAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}
          </p>
          {quote.message ? <p className="mt-2 rounded-xl bg-ink-50 p-3 text-sm whitespace-pre-line">{quote.message}</p> : null}
        </Card>
      ) : null}
      <Card>
        <ManualInvoiceForm invoiceId={null} initial={initial} stock={stock} />
      </Card>
    </>
  );
}

/** Turns the request into a first line, priced from the cheapest matching container in stock. */
function quoteLine(q: { size: string | null; quantity: string; condition: string }, stock: Awaited<ReturnType<typeof invoiceStockOptions>>) {
  const match = stock.filter((c) => (!q.size || c.size === q.size) && c.condition === q.condition).sort((a, b) => a.priceNaira - b.priceNaira)[0];
  const size = q.size ? SIZE_LABELS[q.size] ?? q.size : "Shipping container";
  return {
    description: match?.label ?? `${size} — ${q.condition === "NEW" ? "New (one-trip)" : "Used, cargo-worthy"}`,
    containerNumber: "",
    quantity: q.quantity === "6+" ? "6" : q.quantity,
    unitPriceNaira: match ? String(match.priceNaira) : "",
  };
}
