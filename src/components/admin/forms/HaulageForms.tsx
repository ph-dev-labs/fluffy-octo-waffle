"use client";

import { RefreshCw, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { reverifyHaulageAction, saveHaulageSettingsAction, sendHaulageReminderAction, updateHaulageJobAction } from "@/app/admin/actions/haulage";
import { initialState } from "@/app/admin/actions/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { CONTAINER_SIZES, distanceFeeKobo } from "@/lib/delivery/calc";
import { HAULAGE_JOB_STATUSES } from "@/lib/haulage/calc";
import { formatNaira } from "@/lib/money";
import { Card, FormMessage, SubmitButton } from "../ui";

const JOB_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed (paid / part-paid)",
  SCHEDULED: "Truck scheduled",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

export interface JobValues {
  id: string;
  status: string;
  scheduledFor: string | null;
  driverName: string | null;
  driverPhone: string | null;
  truckPlate: string | null;
  adminNote: string | null;
  needsReview: boolean;
  outstandingKobo: number;
  hasOpenPayments: boolean;
}

export function HaulageJobForms({ job }: { job: JobValues }) {
  const [state, action] = useActionState(updateHaulageJobAction.bind(null, job.id), initialState);
  const [vState, vAction] = useActionState(reverifyHaulageAction.bind(null, job.id), initialState);
  const [rState, rAction] = useActionState(sendHaulageReminderAction.bind(null, job.id), initialState);
  const f = state.fields ?? {};
  return (
    <>
      <Card title="Job">
        <form action={action} className="space-y-4">
          <Select name="status" label="Status" defaultValue={job.status}>
            {HAULAGE_JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_LABEL[s]}</option>)}
          </Select>
          <Input name="scheduledFor" type="datetime-local" label="Pickup scheduled for" defaultValue={toLocalInput(job.scheduledFor)} error={f.scheduledFor} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="driverName" label="Driver name" defaultValue={job.driverName ?? ""} maxLength={120} />
            <Input name="driverPhone" type="tel" label="Driver phone" defaultValue={job.driverPhone ?? ""} maxLength={30} />
          </div>
          <Input name="truckPlate" label="Truck plate number" defaultValue={job.truckPlate ?? ""} maxLength={30} hint="Driver and truck are shown to the customer once the job is scheduled." />
          <Textarea name="adminNote" label="Internal note" rows={3} defaultValue={job.adminNote ?? ""} maxLength={2000} placeholder="Not visible to the customer" />
          {job.needsReview ? (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="clearReview" className="size-4 accent-brand-600" /> Mark the review flag as resolved</label>
          ) : null}
          <FormMessage state={state} />
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      </Card>

      <Card title="Payment tools">
        <p className="mb-4 text-xs text-ink-500">Payments can only be confirmed by Paystack. Re-verify if the customer says they paid.</p>
        <div className="space-y-3">
          {job.hasOpenPayments ? (
            <form action={vAction} className="space-y-2">
              <SubmitButton variant="secondary" className="w-full" pendingText="Checking with Paystack…"><RefreshCw className="size-4" /> Re-verify with Paystack</SubmitButton>
              <FormMessage state={vState} />
            </form>
          ) : null}
          {job.outstandingKobo > 0 && job.status !== "CANCELLED" ? (
            <form action={rAction} className="space-y-2">
              <SubmitButton variant="secondary" className="w-full" pendingText="Sending…"><Send className="size-4" /> Email payment link ({formatNaira(job.outstandingKobo)})</SubmitButton>
              <FormMessage state={rState} />
            </form>
          ) : null}
        </div>
      </Card>
    </>
  );
}

export interface HaulageSettingsValues {
  enabled: boolean;
  baseFeeKobo: number;
  ratePerKmKobo: number;
  minFeeKobo: number;
  maxFeeKobo: number;
  maxDistanceKm: number;
  allowDeposit: boolean;
  depositPct: number;
  sizeMultipliers: Record<string, number>;
}

const SIZE_LABEL: Record<string, string> = { "20FT": "20ft", "40FT": "40ft", "40HC": "40ft High Cube", "45HC": "45ft High Cube" };

export function HaulageSettingsForm({ settings }: { settings: HaulageSettingsValues }) {
  const [state, action] = useActionState(saveHaulageSettingsAction, initialState);
  const f = state.fields ?? {};
  const [v, setV] = useState({ baseFee: settings.baseFeeKobo / 100, ratePerKm: settings.ratePerKmKobo / 100, minFee: settings.minFeeKobo / 100, maxFee: settings.maxFeeKobo / 100 });
  const [depositPct, setDepositPct] = useState(settings.depositPct);
  const num = (k: keyof typeof v) => ({
    name: k,
    type: "number" as const,
    min: 0,
    step: "1",
    value: Number.isFinite(v[k]) ? v[k] : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.valueAsNumber })),
    error: f[k],
  });
  const rules = { baseFeeKobo: (v.baseFee || 0) * 100, ratePerKmKobo: (v.ratePerKm || 0) * 100, minFeeKobo: (v.minFee || 0) * 100, maxFeeKobo: (v.maxFee || 0) * 100 };

  return (
    <form action={action} className="space-y-6">
      <label className="flex items-start gap-3 rounded-xl bg-ink-50 p-4 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-0.5 size-4 accent-brand-600" />
        <span><span className="font-semibold">Accept truck bookings online</span><span className="block text-ink-500">Off: the booking page asks customers to contact you instead.</span></span>
      </label>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Price per 20ft container</h3>
        <p className="mb-3 text-xs text-ink-500">Base + (road km from pickup to drop-off × rate), kept between minimum and maximum, rounded to the nearest ₦1,000.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="Base fee (₦)" required {...num("baseFee")} />
          <Input label="Rate per km (₦)" required {...num("ratePerKm")} />
          <Input label="Minimum (₦)" required {...num("minFee")} />
          <Input label="Maximum (₦)" required {...num("maxFee")} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[10, 50, 150, 400, 800].map((km) => (
            <span key={km} className="rounded-lg bg-ink-50 px-2.5 py-1 text-xs text-ink-600">{km} km → <strong className="text-ink-900">{formatNaira(distanceFeeKobo(km, rules))}</strong></span>
          ))}
        </div>
      </div>

      <Input name="maxDistanceKm" type="number" min={1} label="Longest trip booked online (km)" required defaultValue={settings.maxDistanceKm} error={f.maxDistanceKm} hint="Longer trips are asked to contact you for a quote." className="sm:max-w-sm" />

      <div>
        <h3 className="mb-1 text-sm font-semibold">Container size adjustment</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          {CONTAINER_SIZES.map((s) => (
            <Input key={s} name={`m_${s}`} type="number" min={10} max={1000} label={`${SIZE_LABEL[s]} (%)`} required defaultValue={settings.sizeMultipliers[s] ?? 100} error={f[`m_${s}`]} />
          ))}
        </div>
      </div>

      <div className="rounded-xl ring-1 ring-ink-100 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="allowDeposit" defaultChecked={settings.allowDeposit} className="mt-0.5 size-4 accent-brand-600" />
          <span><span className="font-semibold">Allow part payment</span><span className="block text-ink-500">Customers can pay a deposit now and the balance later from their booking link.</span></span>
        </label>
        <Input
          name="depositPct"
          type="number"
          min={10}
          max={90}
          label="Deposit (%)"
          required
          value={depositPct}
          onChange={(e) => setDepositPct(e.target.valueAsNumber)}
          error={f.depositPct}
          hint={Number.isFinite(depositPct) ? `e.g. on a ₦500,000 trip: ${formatNaira(500_000 * depositPct)} now, the rest before delivery.` : undefined}
          className="mt-4 sm:max-w-xs"
        />
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save truck hire pricing</SubmitButton>
    </form>
  );
}
