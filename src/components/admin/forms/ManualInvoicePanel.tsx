"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Download, Eye, FileText, Pencil, RotateCcw, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { sendInvoiceAction, setInvoicePaidAction } from "@/app/admin/actions/invoices";
import { initialState } from "@/app/admin/actions/types";
import { Badge } from "../badges";
import { ConfirmSubmit, FormMessage, SubmitButton } from "../ui";
import { ManualInvoiceForm, type ManualInvoiceValues } from "./ManualInvoiceForm";

interface Props {
  invoice: { id: string; number: string; status: string; sentAt: string | null; sentTo: string | null; sendCount: number; paidAt: string | null; totalLabel: string };
  values: ManualInvoiceValues;
  stock: { id: string; label: string; priceNaira: number }[];
}

const when = (iso: string) => new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });

export function ManualInvoicePanel({ invoice, values, stock }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, send] = useActionState(sendInvoiceAction.bind(null, invoice.id), initialState);
  const sent = invoice.status === "SENT";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {editing ? (
        <motion.div key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <ManualInvoiceForm invoiceId={invoice.id} initial={values} stock={stock} sent={sent} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </motion.div>
      ) : (
        <motion.div key="summary" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#192440] text-white">
                <FileText className="size-5" />
              </span>
              <div>
                <p className="font-mono text-sm font-bold">{invoice.number} · {invoice.totalLabel}</p>
                <p className="text-xs text-ink-500">
                  {sent ? `Sent to ${invoice.sentTo} · ${when(invoice.sentAt!)}${invoice.sendCount > 1 ? ` · ${invoice.sendCount}×` : ""}` : "Draft — not yet sent to the client"}
                  {invoice.paidAt ? ` · paid ${when(invoice.paidAt)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {sent ? <Badge tone="green">sent</Badge> : <Badge tone="amber">draft</Badge>}
              {invoice.paidAt ? <Badge tone="green">paid</Badge> : <Badge>unpaid</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
              <Eye className="size-4" /> Preview PDF
            </a>
            <a href={`/api/admin/invoices/${invoice.id}/pdf?download=1`} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
              <Download className="size-4" /> Download
            </a>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
              <Pencil className="size-4" /> Edit
            </button>
            <form
              action={send}
              onSubmit={(e) => {
                if (sent && !confirm(`Send invoice ${invoice.number} to ${values.customerEmail} again?`)) e.preventDefault();
              }}
            >
              <SubmitButton pendingText="Sending…">
                <Send className="size-4" /> {sent ? "Resend to client" : "Send to client"}
              </SubmitButton>
            </form>
            <form action={setInvoicePaidAction.bind(null, invoice.id, !invoice.paidAt)}>
              {invoice.paidAt ? (
                <ConfirmSubmit variant="secondary" className="h-10 rounded-xl" message={`Mark ${invoice.number} as unpaid again?`}>
                  <RotateCcw className="size-4" /> Mark unpaid
                </ConfirmSubmit>
              ) : (
                <ConfirmSubmit variant="secondary" className="h-10 rounded-xl" message={`Confirm the bank transfer for ${invoice.number} has arrived? The PDF will show PAID.`}>
                  <BadgeCheck className="size-4" /> Mark as paid
                </ConfirmSubmit>
              )}
            </form>
          </div>
          <FormMessage state={state} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
