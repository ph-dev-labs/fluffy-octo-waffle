"use client";

import { AlertTriangle, Plus, Send, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { saveManualInvoiceAction } from "@/app/admin/actions/invoices";
import { initialState } from "@/app/admin/actions/types";
import { checkContainerNumber } from "@/lib/container-number";
import { formatNaira } from "@/lib/money";
import { Input, Textarea } from "@/components/ui/Field";
import { FormMessage, SubmitButton } from "../ui";

export interface ManualLineValue {
  description: string;
  containerNumber: string;
  quantity: string;
  unitPriceNaira: string;
}

export interface ManualInvoiceValues {
  customerName: string;
  companyName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  deliveryAddress: string;
  deliveryNaira: string;
  dueDate: string;
  note: string;
  quoteRequestId: string;
  lines: ManualLineValue[];
}

export const EMPTY_LINE: ManualLineValue = { description: "", containerNumber: "", quantity: "1", unitPriceNaira: "" };

interface Props {
  invoiceId: string | null;
  initial: ManualInvoiceValues;
  /** Containers in stock, for one-click lines. */
  stock: { id: string; label: string; priceNaira: number }[];
  sent?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}

const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function ManualInvoiceForm({ invoiceId, initial, stock, sent, onDone, onCancel }: Props) {
  const [state, action] = useActionState(async (prev: typeof initialState, fd: FormData) => {
    const res = await saveManualInvoiceAction(invoiceId, prev, fd);
    if (res.ok) onDone?.();
    return res;
  }, initialState);
  // Controlled so a failed save doesn't wipe what the admin typed (React resets uncontrolled fields after an action).
  const [v, setV] = useState(initial);
  const set = <K extends keyof ManualInvoiceValues>(k: K, value: ManualInvoiceValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const setLine = (i: number, patch: Partial<ManualLineValue>) => set("lines", v.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const [intent, setIntent] = useState<"draft" | "send">("draft");
  // Written synchronously on click so the submitted FormData always has the right intent.
  const intentRef = useRef<HTMLInputElement>(null);
  const choose = (x: "draft" | "send") => {
    if (intentRef.current) intentRef.current.value = x;
    setIntent(x);
  };

  const f = state.fields ?? {};
  const subtotal = v.lines.reduce((sum, l) => sum + Math.round(num(l.unitPriceNaira) * 100) * Math.max(0, Math.trunc(num(l.quantity))), 0);
  const delivery = Math.round(num(v.deliveryNaira) * 100);

  const addFromStock = (id: string) => {
    const c = stock.find((x) => x.id === id);
    if (!c) return;
    const line = { ...EMPTY_LINE, description: c.label, unitPriceNaira: String(c.priceNaira) };
    // Replace the untouched starter row instead of leaving a blank line above.
    const blank = v.lines.length === 1 && !v.lines[0].description && !v.lines[0].unitPriceNaira;
    set("lines", blank ? [line] : [...v.lines, line]);
  };

  return (
    <form action={action} className="space-y-8" noValidate>
      <input ref={intentRef} type="hidden" name="intent" defaultValue="draft" />
      <input type="hidden" name="quoteRequestId" value={v.quoteRequestId} />
      <input type="hidden" name="lines" value={JSON.stringify(v.lines)} />

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-base font-bold">Client</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="customerName" label="Client name" hint="A person or a company." required value={v.customerName} onChange={(e) => set("customerName", e.target.value)} error={f.customerName} />
          <Input name="companyName" label="Company" value={v.companyName} onChange={(e) => set("companyName", e.target.value)} error={f.companyName} />
          <Input name="customerEmail" type="email" label="Email" required hint="The invoice is emailed here." value={v.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} error={f.customerEmail} />
          <Input name="customerPhone" type="tel" label="Phone" required value={v.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} error={f.customerPhone} />
        </div>
        <Input name="customerAddress" label="Billing address" value={v.customerAddress} onChange={(e) => set("customerAddress", e.target.value)} error={f.customerAddress} />
      </fieldset>

      <fieldset className="space-y-3">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <legend className="font-display text-base font-bold">Containers</legend>
          {stock.length ? (
            <select
              value=""
              onChange={(e) => addFromStock(e.target.value)}
              aria-label="Add a container from stock"
              className="h-10 max-w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 outline-none focus:border-brand-500"
            >
              <option value="">+ Add from stock…</option>
              {stock.map((c) => (
                <option key={c.id} value={c.id}>{c.label} — {formatNaira(c.priceNaira * 100)}</option>
              ))}
            </select>
          ) : null}
        </div>

        {v.lines.map((l, i) => {
          const err = (k: string) => f[`lines.${i}.${k}`];
          const cn6346 = l.containerNumber.trim() ? checkContainerNumber(l.containerNumber) : null;
          return (
            <div key={i} className="rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
              <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                <Input label={`Description ${v.lines.length > 1 ? i + 1 : ""}`.trim()} placeholder="e.g. 40ft High Cube — Used, cargo-worthy" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} error={err("description")} />
                <Input
                  label="Container no."
                  placeholder="Optional"
                  value={l.containerNumber}
                  onChange={(e) => setLine(i, { containerNumber: e.target.value.toUpperCase() })}
                  error={err("containerNumber")}
                  hint={cn6346 && !cn6346.ok && cn6346.reason === "check_digit" ? "Check digit doesn't match — re-check the door" : undefined}
                  className="[&_input]:font-mono [&_input]:uppercase"
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="mt-3 grid grid-cols-[5rem_1fr_auto] items-end gap-3 sm:grid-cols-[6rem_12rem_1fr_auto]">
                <Input label="Qty" type="number" min={1} step={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} error={err("quantity")} />
                <Input label="Unit price (₦)" type="number" min={0} step="1" value={l.unitPriceNaira} onChange={(e) => setLine(i, { unitPriceNaira: e.target.value })} error={err("unitPriceNaira")} />
                <p className="hidden pb-3 text-right text-sm font-semibold text-ink-700 sm:block">{formatNaira(Math.round(num(l.unitPriceNaira) * 100) * Math.max(0, Math.trunc(num(l.quantity))))}</p>
                <button
                  type="button"
                  onClick={() => set("lines", v.lines.filter((_, k) => k !== i))}
                  disabled={v.lines.length === 1}
                  aria-label={`Remove line ${i + 1}`}
                  className="mb-1 grid size-10 place-items-center rounded-lg text-ink-400 hover:bg-danger-100 hover:text-danger-600 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
        {f.lines ? <p className="text-xs font-medium text-danger-600">{f.lines}</p> : null}
        <button type="button" onClick={() => set("lines", [...v.lines, { ...EMPTY_LINE }])} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50">
          <Plus className="size-4" /> Add another line
        </button>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 font-display text-base font-bold">Delivery &amp; terms</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Input name="deliveryAddress" label="Delivery address" hint="Leave empty if the client collects from our terminal." value={v.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} error={f.deliveryAddress} />
          <Input name="deliveryNaira" label="Delivery cost (₦)" type="number" min={0} step="1" value={v.deliveryNaira} onChange={(e) => set("deliveryNaira", e.target.value)} error={f.deliveryNaira} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Input name="dueDate" label="Payment due" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={f.dueDate} />
          <Textarea name="note" label="Note on invoice" rows={2} maxLength={1000} placeholder="e.g. Price valid for 7 days. Delivery within 3 working days of payment." value={v.note} onChange={(e) => set("note", e.target.value)} error={f.note} />
        </div>
      </fieldset>

      <dl className="ml-auto max-w-xs space-y-1.5 rounded-xl bg-ink-50 p-4 text-sm">
        <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Delivery</dt><dd>{v.deliveryAddress || delivery ? formatNaira(delivery) : "Collection"}</dd></div>
        <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-bold"><dt>Amount due</dt><dd>{formatNaira(subtotal + delivery)}</dd></div>
      </dl>

      <FormMessage state={state} />
      {sent ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-100 p-3 text-sm text-warning-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> This invoice was already sent. Saving changes won&apos;t notify the client unless you choose &quot;Save &amp; resend&quot;.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span onClickCapture={() => choose("send")}>
          <SubmitButton pendingText={intent === "send" ? "Generating & sending…" : "Saving…"}>
            <Send className="size-4" /> {sent ? "Save & resend" : "Generate & send"}
          </SubmitButton>
        </span>
        <span onClickCapture={() => choose("draft")}>
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save draft
          </SubmitButton>
        </span>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-semibold text-ink-600 hover:bg-ink-50">
            Cancel
          </button>
        ) : null}
      </div>
      <p className="text-xs text-ink-400">&quot;Generate &amp; send&quot; emails the PDF to {v.customerEmail || "the client"}. Use &quot;Save draft&quot; to preview it first.</p>
    </form>
  );
}
