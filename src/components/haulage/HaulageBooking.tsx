"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Clock, Copy, Loader2, Lock, MapPin, Phone, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ApiError, fetchJson, NetworkError } from "@/lib/client/fetch-json";
import { openPaystack } from "@/lib/client/paystack";
import { depositKobo } from "@/lib/haulage/calc";
import type { PublicHaulage } from "@/lib/haulage/payments";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";

const STEPS = [
  { s: "CONFIRMED", l: "Confirmed" },
  { s: "SCHEDULED", l: "Truck scheduled" },
  { s: "IN_TRANSIT", l: "On the way" },
  { s: "DELIVERED", l: "Delivered" },
] as const;

const KIND: Record<string, string> = { FULL: "Full payment", DEPOSIT: "Deposit", BALANCE: "Balance" };
const POLL = [0, 2000, 3000, 5000, 8000, 12000, 15000, 20000, 30000];

export function HaulageBooking({ initial, linkKey, allowDeposit }: { initial: PublicHaulage; linkKey: string; allowDeposit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [b, setB] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [plan, setPlan] = useState<"FULL" | "DEPOSIT">("FULL");
  const [paying, setPaying] = useState(false);
  const idem = useRef<{ fp: string; key: string } | null>(null);
  // Paystack's popup sends us back with ?payment=…, its redirect flow with ?reference=…
  const watched = params.get("payment") ?? params.get("reference");
  const cancelled = params.get("cancelled") === "1";

  const refresh = useCallback(
    async (payment?: string | null) => {
      const qs = new URLSearchParams({ reference: b.reference, k: linkKey, ...(payment ? { payment } : {}) });
      const { booking } = await fetchJson<{ booking: PublicHaulage }>(`/api/haulage/status?${qs}`, { retries: 1, timeoutMs: 20_000 });
      setB(booking);
      return booking;
    },
    [b.reference, linkKey],
  );

  // After returning from Paystack, keep checking that instalment until it settles.
  useEffect(() => {
    if (!watched) return;
    let stopped = false;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    setChecking(true);
    const tick = async () => {
      try {
        const booking = await refresh(watched);
        const p = booking.payments.find((x) => x.reference === watched);
        if (!p || p.status !== "PENDING" || cancelled) {
          setChecking(false);
          if (p?.status === "PAID") toast.success(`Payment of ${formatNaira(p.amountKobo)} received`);
          return;
        }
      } catch (err) {
        if (!(err instanceof NetworkError)) {
          /* server busy: keep trying, the payment is safe */
        }
      }
      if (stopped) return;
      i++;
      if (i > 40) return setChecking(false); // ~15 min; the server keeps reconciling after this
      timer = setTimeout(tick, POLL[Math.min(i, POLL.length - 1)]);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [watched, cancelled, refresh]);

  async function pay() {
    if (paying) return;
    const fp = `${b.reference}:${b.paidKobo}:${plan}`;
    if (idem.current?.fp !== fp) idem.current = { fp, key: crypto.randomUUID() };
    setPaying(true);
    try {
      const { payment } = await fetchJson<{ payment: { reference: string; accessCode: string; authorizationUrl: string } }>("/api/haulage/pay", {
        method: "POST",
        json: { reference: b.reference, key: linkKey, plan, idempotencyKey: idem.current.key },
        retries: 3,
        timeoutMs: 30_000,
      });
      const here = window.location.pathname;
      await openPaystack({
        accessCode: payment.accessCode,
        authorizationUrl: payment.authorizationUrl,
        onSuccess: () => router.replace(`${here}?payment=${payment.reference}`),
        onCancel: () => router.replace(`${here}?payment=${payment.reference}&cancelled=1`),
        onError: () => router.replace(`${here}?payment=${payment.reference}`),
      });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "ORDER_CLOSED" || err.code === "IDEMPOTENCY_KEY_REUSED")) idem.current = null;
      toast.error(err instanceof ApiError || err instanceof NetworkError ? err.message : "Couldn't start the payment. You have not been charged.");
    } finally {
      setPaying(false);
    }
  }

  const due = b.outstandingKobo;
  const nothingPaid = b.paidKobo === 0;
  const deposit = depositKobo(b.totalKobo, b.depositPct);
  const amountNow = nothingPaid && plan === "DEPOSIT" ? deposit : due;
  const stepIndex = STEPS.findIndex((s) => s.s === b.status);
  const pendingWatched = watched ? b.payments.find((p) => p.reference === watched) : undefined;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">Truck booking</p>
          <h1 className="font-display mt-1 flex flex-wrap items-center gap-3 text-4xl font-extrabold tracking-tight">
            {b.reference}
            <button type="button" onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast.success("Link copied — keep it private"))} className="grid size-9 place-items-center rounded-xl ring-1 ring-ink-200 hover:bg-ink-50" aria-label="Copy booking link">
              <Copy className="size-4" />
            </button>
          </h1>
          <p className="mt-2 text-ink-500">Bookmark this page — it&apos;s your private link to track the job and pay. We&apos;ve also emailed it to {b.email}.</p>
        </div>

        <AnimatePresence>
          {checking && pendingWatched?.status === "PENDING" ? (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-ink-700">
              <Loader2 className="size-4 animate-spin text-brand-600" /> Confirming your payment with Paystack… you can safely leave this page; we&apos;ll email your receipt.
            </motion.div>
          ) : cancelled && pendingWatched?.status === "PENDING" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-warning-100 p-4 text-sm text-warning-600">
              <AlertTriangle className="size-4" /> Payment window closed. You have not been charged — you can pay below whenever you&apos;re ready.
            </motion.div>
          ) : pendingWatched && ["FAILED", "ABANDONED"].includes(pendingWatched.status) ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-danger-100 p-4 text-sm text-danger-600">
              <AlertTriangle className="size-4" /> That payment didn&apos;t go through. You have not been charged — please try again.
            </motion.div>
          ) : null}
        </AnimatePresence>

        {b.status === "CANCELLED" ? (
          <div className="rounded-3xl bg-ink-100 p-6 text-ink-700">This booking was cancelled. Contact us if you have questions about a refund.</div>
        ) : b.status === "AWAITING_PAYMENT" ? (
          <div className="flex items-start gap-3 rounded-3xl bg-warning-100 p-6 text-sm text-warning-600">
            <Clock className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold text-ink-900">Awaiting payment</p>
              <p>Your truck is reserved once the first payment is received.</p>
            </div>
          </div>
        ) : (
          <ol className="grid grid-cols-4 gap-2 rounded-3xl bg-white p-5 ring-1 ring-ink-900/5">
            {STEPS.map((s, i) => {
              const done = i <= stepIndex;
              return (
                <li key={s.s} className="flex flex-col items-center gap-2 text-center">
                  <motion.span initial={false} animate={{ scale: done ? 1 : 0.9 }} className={cn("grid size-9 place-items-center rounded-full", done ? "bg-success-600 text-white" : "bg-ink-100 text-ink-400")}>
                    {done ? <CheckCircle2 className="size-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                  </motion.span>
                  <span className={cn("text-xs font-medium", done ? "text-ink-900" : "text-ink-400")}>{s.l}</span>
                </li>
              );
            })}
          </ol>
        )}

        {b.driver ? (
          <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-ink-900 p-5 text-white">
            <Truck className="size-6 text-accent-500" />
            <div className="flex-1">
              <p className="font-semibold">{b.driver.name ?? "Your driver"}{b.driver.truck ? ` · ${b.driver.truck}` : ""}</p>
              {b.scheduledFor ? <p className="text-sm text-ink-300">Scheduled for {new Date(b.scheduledFor).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p> : null}
            </div>
            {b.driver.phone ? (
              <a href={`tel:${b.driver.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-900"><Phone className="size-4" /> Call driver</a>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-ink-900/5">
          <Leg icon="from" label="Pickup" address={b.pickupAddress} state={b.pickupState} />
          <div className="ml-4 h-6 border-l-2 border-dashed border-ink-200" aria-hidden />
          <Leg icon="to" label="Drop-off" address={b.dropoffAddress} state={b.dropoffState} />
          <p className="border-t border-ink-100 pt-4 text-sm text-ink-600">
            {b.containerCount} × {b.containerSize} container{b.containerCount > 1 ? "s" : ""} · about {Math.round(b.distanceKm)} km
            {b.preferredDate ? ` · preferred ${new Date(b.preferredDate).toLocaleDateString("en-NG", { dateStyle: "medium" })}` : ""}
          </p>
        </div>

        {b.payments.length ? (
          <div className="rounded-3xl bg-white p-6 ring-1 ring-ink-900/5">
            <h2 className="font-display mb-3 font-bold">Payments</h2>
            <ul className="divide-y divide-ink-100 text-sm">
              {b.payments.map((p) => (
                <li key={p.reference} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    {KIND[p.kind] ?? p.kind}
                    <span className="block text-xs text-ink-400">{new Date(p.paidAt ?? p.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">{formatNaira(p.amountKobo)}</span>
                    <span className={cn("text-xs font-semibold", p.status === "PAID" ? "text-success-600" : p.status === "PENDING" ? "text-warning-600" : "text-ink-400")}>{p.status === "PAID" ? "Paid" : p.status === "PENDING" ? "Not completed" : p.status.toLowerCase().replace("_", " ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <aside className="h-fit space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-900/5 lg:sticky lg:top-28">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-500">Total</dt><dd className="font-medium tabular-nums">{formatNaira(b.totalKobo)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Paid</dt><dd className="font-medium text-success-600 tabular-nums">{formatNaira(b.paidKobo)}</dd></div>
          <div className="flex items-baseline justify-between border-t border-ink-100 pt-3">
            <dt className="font-semibold">Balance</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{formatNaira(due)}</dd>
          </div>
        </dl>

        {b.status === "CANCELLED" ? null : due === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-success-100 p-4 text-sm font-semibold text-success-600"><CheckCircle2 className="size-5" /> Fully paid — thank you!</p>
        ) : (
          <>
            {nothingPaid && allowDeposit ? (
              <div role="radiogroup" aria-label="How would you like to pay?" className="grid gap-2">
                {(
                  [
                    { v: "FULL", t: "Pay in full", d: formatNaira(b.totalKobo) },
                    { v: "DEPOSIT", t: `Pay ${b.depositPct}% deposit`, d: `${formatNaira(deposit)} now, rest before delivery` },
                  ] as const
                ).map((o) => (
                  <button key={o.v} type="button" role="radio" aria-checked={plan === o.v} onClick={() => setPlan(o.v)} className={cn("rounded-2xl border-2 p-3 text-left text-sm", plan === o.v ? "border-brand-600 bg-brand-50" : "border-ink-200 hover:border-ink-300")}>
                    <span className="block font-semibold">{o.t}</span>
                    <span className="block text-ink-500">{o.d}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <Button size="lg" className="w-full" onClick={pay} loading={paying} disabled={checking && pendingWatched?.status === "PENDING"} icon={<Lock className="size-4" />}>
              {nothingPaid ? `Pay ${formatNaira(amountNow)}` : `Pay balance ${formatNaira(due)}`}
            </Button>
          </>
        )}
        <button type="button" onClick={() => refresh().catch(() => toast.error("Couldn't refresh — check your connection."))} className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-900">
          <RefreshCw className="size-4" /> Refresh status
        </button>
      </aside>
    </div>
  );
}

function Leg({ icon, label, address, state }: { icon: "from" | "to"; label: string; address: string; state: string | null }) {
  return (
    <div className="flex gap-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", icon === "from" ? "bg-ink-900 text-white" : "bg-accent-500 text-white")}><MapPin className="size-4" /></span>
      <div>
        <p className="text-xs font-semibold tracking-wide text-ink-400 uppercase">{label}{state ? ` · ${state}` : ""}</p>
        <p className="text-sm text-ink-800">{address}</p>
      </div>
    </div>
  );
}
