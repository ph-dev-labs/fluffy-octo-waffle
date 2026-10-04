"use client";

import { useActionState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { reverifyOrderAction, resendReceiptAction, resolveReviewAction, updateFulfilmentAction } from "@/app/admin/actions/orders";
import { initialState } from "@/app/admin/actions/types";
import { Select, Textarea } from "@/components/ui/Field";
import { FULFILMENT_STATUSES } from "../badges";
import { Card, FormMessage, SubmitButton } from "../ui";

export function OrderActions({ id, status, fulfilmentStatus, adminNote }: { id: string; status: string; fulfilmentStatus: string; adminNote: string }) {
  const [fState, fAction] = useActionState(updateFulfilmentAction.bind(null, id), initialState);
  const [vState, vAction] = useActionState(reverifyOrderAction.bind(null, id), initialState);
  const [rState, rAction] = useActionState(resendReceiptAction.bind(null, id), initialState);

  return (
    <>
      <Card title="Fulfilment">
        <form action={fAction} className="space-y-4">
          <Select name="fulfilmentStatus" label="Status" defaultValue={fulfilmentStatus}>
            {FULFILMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </Select>
          <Textarea name="adminNote" label="Internal note" rows={3} defaultValue={adminNote} maxLength={2000} placeholder="Truck plate, driver phone, ETA…" />
          <FormMessage state={fState} />
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      </Card>

      <Card title="Payment tools">
        <p className="mb-4 text-xs text-ink-500">Payment status can only be changed by Paystack. Use re-verify if a customer says they paid.</p>
        <div className="space-y-3">
          <form action={vAction} className="space-y-2">
            <SubmitButton variant="secondary" className="w-full" pendingText="Checking with Paystack…">
              <RefreshCw className="size-4" /> Re-verify with Paystack
            </SubmitButton>
            <FormMessage state={vState} />
          </form>
          {status === "PAID" ? (
            <form action={rAction} className="space-y-2">
              <SubmitButton variant="secondary" className="w-full" pendingText="Sending…">
                <Send className="size-4" /> Resend receipt email
              </SubmitButton>
              <FormMessage state={rState} />
            </form>
          ) : null}
        </div>
      </Card>
    </>
  );
}

export function ResolveReviewForm({ id }: { id: string }) {
  const [state, action] = useActionState(resolveReviewAction.bind(null, id), initialState);
  return (
    <form action={action} className="space-y-3">
      <Textarea name="resolution" label="Resolution" rows={2} required placeholder="e.g. Refunded ₦50,000 difference via Paystack dashboard" error={state.fields?.resolution} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Mark resolved</SubmitButton>
    </form>
  );
}
