"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Download, Eye, FileText, Pencil, Send } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { saveInvoiceAction, sendInvoiceAction } from "@/app/admin/actions/invoices";
import { initialState } from "@/app/admin/actions/types";
import { checkContainerNumber, formatContainerNumber } from "@/lib/container-number";
import { Textarea } from "@/components/ui/Field";
import { Badge } from "../badges";
import { FormMessage, SubmitButton } from "../ui";
import { cn } from "@/lib/utils";

export interface InvoiceSummary {
  id: string;
  number: string;
  status: string;
  sentAt: string | null;
  sentTo: string | null;
  sendCount: number;
  containerNumbers: string[];
  note: string | null;
}

interface Props {
  orderId: string;
  customerEmail: string;
  eligibility: { ok: true } | { ok: false; reason: string };
  units: { label: string }[];
  invoice: InvoiceSummary | null;
}

export function InvoicePanel({ orderId, customerEmail, eligibility, units, invoice }: Props) {
  const [editing, setEditing] = useState(!invoice);

  if (!eligibility.ok && !invoice) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
        <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" />
        {eligibility.reason}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {editing || !invoice ? (
        <motion.div key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <InvoiceForm orderId={orderId} customerEmail={customerEmail} units={units} invoice={invoice} onDone={() => setEditing(false)} onCancel={invoice ? () => setEditing(false) : undefined} />
        </motion.div>
      ) : (
        <motion.div key="summary" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <InvoiceSummaryView invoice={invoice} units={units} customerEmail={customerEmail} eligible={eligibility.ok} onEdit={() => setEditing(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InvoiceSummaryView({ invoice, units, customerEmail, eligible, onEdit }: { invoice: InvoiceSummary; units: { label: string }[]; customerEmail: string; eligible: boolean; onEdit: () => void }) {
  const [state, action] = useActionState(sendInvoiceAction.bind(null, invoice.id), initialState);
  const sent = invoice.status === "SENT";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#192440] text-white">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="font-mono text-sm font-bold">{invoice.number}</p>
            <p className="text-xs text-ink-500">
              {sent ? `Sent to ${invoice.sentTo} · ${new Date(invoice.sentAt!).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}${invoice.sendCount > 1 ? ` · ${invoice.sendCount}×` : ""}` : "Draft — not yet sent to the customer"}
            </p>
          </div>
        </div>
        {sent ? <Badge tone="green">sent</Badge> : <Badge tone="amber">draft</Badge>}
      </div>

      <ul className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-100">
        {units.map((u, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-ink-600">{u.label}</span>
            <span className="font-mono font-semibold text-[#192440]">{formatContainerNumber(invoice.containerNumbers[i] ?? "")}</span>
          </li>
        ))}
      </ul>
      {invoice.note ? <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-600">{invoice.note}</p> : null}

      <div className="flex flex-wrap gap-2">
        <a href={`/api/admin/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
          <Eye className="size-4" /> Preview PDF
        </a>
        <a href={`/api/admin/invoices/${invoice.id}/pdf?download=1`} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
          <Download className="size-4" /> Download
        </a>
        <button type="button" onClick={onEdit} disabled={!eligible} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50 disabled:opacity-50">
          <Pencil className="size-4" /> Edit
        </button>
        {eligible ? (
          <form
            action={action}
            onSubmit={(e) => {
              if (sent && !confirm(`Send invoice ${invoice.number} to ${customerEmail} again?`)) e.preventDefault();
            }}
          >
            <SubmitButton pendingText="Sending…">
              <Send className="size-4" /> {sent ? "Resend to customer" : "Send to customer"}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

function InvoiceForm({ orderId, customerEmail, units, invoice, onDone, onCancel }: { orderId: string; customerEmail: string; units: { label: string }[]; invoice: InvoiceSummary | null; onDone: () => void; onCancel?: () => void }) {
  const [state, action] = useActionState(async (prev: typeof initialState, fd: FormData) => {
    const res = await saveInvoiceAction(orderId, prev, fd);
    if (res.ok) onDone();
    return res;
  }, initialState);
  const [values, setValues] = useState<string[]>(() => units.map((_, i) => invoice?.containerNumbers[i] ?? ""));
  const [touched, setTouched] = useState<boolean[]>(() => units.map(() => false));
  const [skip, setSkip] = useState(false);
  // Controlled so a failed save doesn't wipe what the admin typed (React resets uncontrolled fields after an action).
  const [note, setNote] = useState(invoice?.note ?? "");
  const [intent, setIntent] = useState<"draft" | "send">("draft");
  // Written synchronously on click so the submitted FormData always has the right intent.
  const intentRef = useRef<HTMLInputElement>(null);
  const choose = (v: "draft" | "send") => {
    if (intentRef.current) intentRef.current.value = v;
    setIntent(v);
  };

  const checks = useMemo(() => values.map((v) => checkContainerNumber(v, { skipCheckDigit: skip })), [values, skip]);
  const anyCheckDigitError = useMemo(() => values.some((v) => { const r = checkContainerNumber(v); return !r.ok && r.reason === "check_digit"; }), [values]);
  const allValid = checks.every((c) => c.ok);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input ref={intentRef} type="hidden" name="intent" defaultValue="draft" />
      <p className="text-sm text-ink-500">
        Enter the number painted on each container&apos;s door (ISO 6346, e.g. <span className="font-mono">CSQU 305438 3</span>). We check every number for typos before it goes on the invoice.
      </p>

      <div className="space-y-3">
        {units.map((u, i) => {
          const c = checks[i];
          const serverError = state.fields?.[`container_${i}`];
          const showError = (touched[i] && !c.ok && values[i] !== "") || serverError;
          return (
            <div key={i}>
              <label htmlFor={`container_${i}`} className="mb-1.5 flex items-center justify-between text-sm font-medium text-ink-700">
                <span>{u.label}</span>
                {c.ok ? <CheckCircle2 className="size-4 text-success-600" aria-label="Valid" /> : null}
              </label>
              <input
                id={`container_${i}`}
                name={`container_${i}`}
                value={values[i]}
                onChange={(e) => setValues((v) => v.map((x, k) => (k === i ? e.target.value.toUpperCase() : x)))}
                onBlur={() => setTouched((t) => t.map((x, k) => (k === i ? true : x)))}
                placeholder="CSQU 305438 3"
                autoComplete="off"
                spellCheck={false}
                maxLength={20}
                aria-invalid={!!showError || undefined}
                className={cn(
                  "h-12 w-full rounded-xl border bg-white px-4 font-mono text-[15px] tracking-wider uppercase outline-none focus:ring-4 focus:ring-brand-500/15",
                  showError ? "border-danger-600" : c.ok ? "border-success-600/50" : "border-ink-200 focus:border-brand-500",
                )}
              />
              {showError ? <p className="mt-1 text-xs font-medium text-danger-600">{serverError ?? (!c.ok ? c.message : "")}</p> : null}
            </div>
          );
        })}
      </div>

      {anyCheckDigitError ? (
        <label className="flex items-start gap-2 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">
          <input type="checkbox" name="skipCheckDigit" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="mt-0.5 size-4 accent-warning-600" />
          I&apos;ve double-checked against the container door — the number is correct even though the check digit doesn&apos;t match.
        </label>
      ) : null}

      <Textarea name="note" label="Note on invoice (optional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivered to site on 12 Oct 2026, received by Mr. Okafor." />

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        <span onClickCapture={() => choose("send")}>
          <SubmitButton pendingText={intent === "send" ? "Generating & sending…" : "Saving…"} className={cn(!allValid && "pointer-events-none opacity-50")}>
            <Send className="size-4" /> {invoice?.status === "SENT" ? "Save & resend" : "Generate & send"}
          </SubmitButton>
        </span>
        <span onClickCapture={() => choose("draft")}>
          <SubmitButton variant="secondary" pendingText="Saving…" className={cn(!allValid && "pointer-events-none opacity-50")}>
            Save draft
          </SubmitButton>
        </span>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-semibold text-ink-600 hover:bg-ink-50">
            Cancel
          </button>
        ) : null}
      </div>
      <p className="text-xs text-ink-400">&quot;Generate &amp; send&quot; emails the PDF to {customerEmail}. Use &quot;Save draft&quot; to preview it first.</p>
    </form>
  );
}
