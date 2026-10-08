"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowDown, Loader2, Lock, MapPin, Route, ShieldCheck, Truck, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Honeypot, Input, Select, Textarea } from "@/components/ui/Field";
import type { LatLng } from "@/components/maps/LocationPicker";
import { ApiError, fetchJson, NetworkError } from "@/lib/client/fetch-json";
import { openPaystack } from "@/lib/client/paystack";
import { formatNaira } from "@/lib/money";
import { depositKobo } from "@/lib/haulage/calc";
import { fieldErrors, haulageBookSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

const LocationPicker = dynamic(() => import("@/components/maps/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="skeleton h-[22rem] rounded-2xl" />,
});

const SIZES = [
  { v: "20FT", l: "20ft" },
  { v: "40FT", l: "40ft" },
  { v: "40HC", l: "40ft High Cube" },
  { v: "45HC", l: "45ft High Cube" },
] as const;

interface Quote {
  token: string;
  distanceKm: number;
  method: "DISTANCE" | "ESTIMATE";
  perContainerKobo: number;
  totalKobo: number;
  depositPct: number;
  allowDeposit: boolean;
  pickup: { state: string | null };
  dropoff: { state: string | null };
}

type QuoteState = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; quote: Quote } | { kind: "problem"; message: string };

interface BookResponse {
  booking: { reference: string; path: string };
  payment: { reference: string; accessCode: string; authorizationUrl: string; amountKobo: number };
}

const LAST_BOOKING = "cz.lastHaulageBooking.v1";

export function HaulageForm() {
  const router = useRouter();
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [size, setSize] = useState<string>("20FT");
  const [count, setCount] = useState(1);
  const [quote, setQuote] = useState<QuoteState>({ kind: "idle" });
  const [refresh, setRefresh] = useState(0);
  const [plan, setPlan] = useState<"FULL" | "DEPOSIT">("FULL");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "creating" | "paying">(null);
  const [banner, setBanner] = useState<{ tone: "error" | "offline"; text: string } | null>(null);
  const submitting = useRef(false);
  const idem = useRef<{ fp: string; key: string } | null>(null);

  // Live price whenever both pins, size and count are set.
  useEffect(() => {
    if (!pickup || !dropoff || count < 1) {
      setQuote({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setQuote({ kind: "loading" });
    const t = setTimeout(async () => {
      try {
        const res = await fetchJson<({ ok: true } & Quote) | { ok: false; message: string }>("/api/haulage/quote", {
          method: "POST",
          json: { pickup, dropoff, size, count },
          retries: 2,
          timeoutMs: 25_000,
        });
        if (cancelled) return;
        if (res.ok) {
          setQuote({ kind: "ok", quote: res });
          if (!res.allowDeposit) setPlan("FULL");
        } else setQuote({ kind: "problem", message: res.message });
      } catch (err) {
        if (!cancelled) setQuote({ kind: "problem", message: err instanceof ApiError ? err.message : "We couldn't price this trip — check your connection and try again." });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pickup, dropoff, size, count, refresh]);

  const q = quote.kind === "ok" ? quote.quote : null;
  const deposit = q ? depositKobo(q.totalKobo, q.depositPct) : 0;
  const payNow = q ? (plan === "DEPOSIT" ? deposit : q.totalKobo) : 0;
  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    setBanner(null);
    if (!q) {
      setErrors({ quoteToken: "Set both locations to get a price" });
      setBanner({ tone: "error", text: "Drop both pins (pickup and drop-off) to get your price first." });
      return;
    }
    const fd = new FormData(e.currentTarget);
    const base = {
      quoteToken: q.token,
      plan,
      customer: {
        fullName: String(fd.get("fullName") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        companyName: String(fd.get("companyName") ?? ""),
      },
      pickupAddress: String(fd.get("pickupAddress") ?? ""),
      dropoffAddress: String(fd.get("dropoffAddress") ?? ""),
      preferredDate: String(fd.get("preferredDate") ?? ""),
      containerNumbers: String(fd.get("containerNumbers") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      website: String(fd.get("website") ?? ""),
    };
    // Same details ⇒ same key ⇒ a retry after a dropped connection can't create a second booking.
    const fp = JSON.stringify(base);
    if (idem.current?.fp !== fp) idem.current = { fp, key: crypto.randomUUID() };
    const payload = { ...base, idempotencyKey: idem.current.key };

    const parsed = haulageBookSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setErrors({});
    submitting.current = true;
    setBusy("creating");
    try {
      const res = await fetchJson<BookResponse>("/api/haulage/book", { method: "POST", json: payload, retries: 3, timeoutMs: 40_000 });
      try {
        localStorage.setItem(LAST_BOOKING, res.booking.path);
      } catch {
        /* private mode: the emailed link still works */
      }
      setBusy("paying");
      const page = res.booking.path;
      await openPaystack({
        accessCode: res.payment.accessCode,
        authorizationUrl: res.payment.authorizationUrl,
        onSuccess: () => router.push(`${page}?payment=${encodeURIComponent(res.payment.reference)}`),
        onCancel: () => router.push(`${page}?payment=${encodeURIComponent(res.payment.reference)}&cancelled=1`),
        onError: () => router.push(`${page}?payment=${encodeURIComponent(res.payment.reference)}`),
      });
    } catch (err) {
      setBusy(null);
      handleError(err);
    } finally {
      submitting.current = false;
    }
  }

  function handleError(err: unknown) {
    if (err instanceof NetworkError) {
      setBanner({ tone: "offline", text: `${err.message} You have not been charged. Press Pay again when you're back online — your booking won't be duplicated.` });
      return;
    }
    if (err instanceof ApiError) {
      if (err.code === "QUOTE_EXPIRED") setRefresh((n) => n + 1);
      if (err.code === "IDEMPOTENCY_KEY_REUSED") idem.current = null;
      // The booking exists but the payment couldn't start: its page lets them pay later.
      if (err.fields?.bookingPath) {
        toast.error(err.message);
        router.push(err.fields.bookingPath);
        return;
      }
      if (err.fields) setErrors(err.fields);
      setBanner({ tone: "error", text: err.message });
      return;
    }
    setBanner({ tone: "error", text: "Something went wrong. You have not been charged — please try again." });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative grid gap-8 lg:grid-cols-[1fr_400px]">
      <Honeypot />
      <div className="space-y-8">
        <AnimatePresence>
          {banner ? (
            <motion.div
              role="alert"
              ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "center" })}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn("flex items-start gap-3 rounded-2xl p-4 text-sm", banner.tone === "offline" ? "bg-warning-100 text-warning-600" : "bg-danger-100 text-danger-600")}
            >
              {banner.tone === "offline" ? <WifiOff className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
              {banner.text}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Card step={1} title="Where is your container now?">
          <LocationPicker value={pickup} onChange={setPickup} disabled={!!busy} label="pickup location" />
          <Textarea name="pickupAddress" label="Pickup address & directions" required rows={2} maxLength={500} className="mt-4" error={errors.pickupAddress} disabled={!!busy} placeholder="Terminal / yard / site name, street, landmark…" />
        </Card>

        <div className="-my-4 flex justify-center" aria-hidden>
          <span className="grid size-10 place-items-center rounded-full bg-ink-900 text-white"><ArrowDown className="size-5" /></span>
        </div>

        <Card step={2} title="Where should we take it?">
          <LocationPicker value={dropoff} onChange={setDropoff} disabled={!!busy} label="drop-off location" />
          <Textarea name="dropoffAddress" label="Drop-off address & directions" required rows={2} maxLength={500} className="mt-4" error={errors.dropoffAddress} disabled={!!busy} placeholder="House / plot number, street, estate, gate colour…" />
        </Card>

        <Card step={3} title="Container details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Container size" required value={size} onChange={(e) => setSize(e.target.value)} disabled={!!busy}>
              {SIZES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </Select>
            <Input label="How many containers?" type="number" min={1} max={20} required value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, e.target.valueAsNumber || 1)))} disabled={!!busy} hint="One truck per container." />
            <Input name="preferredDate" type="date" min={minDate} label="Preferred pickup date (optional)" error={errors.preferredDate} disabled={!!busy} />
            <Input name="containerNumbers" label="Container number(s) (optional)" placeholder="e.g. MSCU 123456 7" error={errors.containerNumbers} disabled={!!busy} />
          </div>
          <Textarea name="notes" label="Anything we should know? (optional)" rows={2} maxLength={1000} className="mt-5" disabled={!!busy} placeholder="Release documents, site access, crane on site, etc." />
        </Card>

        <Card step={4} title="Your details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input name="fullName" label="Full name" required autoComplete="name" error={errors["customer.fullName"]} disabled={!!busy} />
            <Input name="companyName" label="Company (optional)" autoComplete="organization" disabled={!!busy} />
            <Input name="email" type="email" label="Email" required autoComplete="email" hint="Your booking link and receipts are sent here." error={errors["customer.email"]} disabled={!!busy} />
            <Input name="phone" type="tel" label="Phone" required autoComplete="tel" inputMode="tel" error={errors["customer.phone"]} disabled={!!busy} />
          </div>
        </Card>
      </div>

      <aside className="h-fit space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-900/5 lg:sticky lg:top-28">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold"><Truck className="size-5 text-brand-600" /> Your trip</h2>

        <AnimatePresence mode="wait" initial={false}>
          {quote.kind === "idle" ? (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-500">
              <MapPin className="mt-0.5 size-4 shrink-0" /> Drop the pickup and drop-off pins to see your price.
            </motion.p>
          ) : quote.kind === "loading" ? (
            <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
              <Loader2 className="size-4 animate-spin" /> Working out the route…
            </motion.p>
          ) : quote.kind === "problem" ? (
            <motion.div key="problem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="space-y-2 rounded-2xl bg-warning-100 p-4 text-sm text-warning-600">
              <p className="flex items-start gap-2 font-medium text-ink-900"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-600" /> {quote.message}</p>
              <p><a href="/contact" className="font-semibold text-brand-600 underline underline-offset-2">Contact us</a> and we&apos;ll quote it personally.</p>
            </motion.div>
          ) : (
            <motion.dl key={q!.token.slice(-10)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2 text-sm">
              <Row label="Route" value={`${q!.pickup.state ?? "Pickup"} → ${q!.dropoff.state ?? "Drop-off"}`} />
              <Row label={q!.method === "DISTANCE" ? "Road distance" : "Distance (approx.)"} value={`${Math.round(q!.distanceKm)} km`} icon={<Route className="size-3.5" />} />
              <Row label="Per container" value={formatNaira(q!.perContainerKobo)} />
              <Row label="Containers" value={`× ${count}`} />
              <div className="flex items-baseline justify-between border-t border-ink-100 pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{formatNaira(q!.totalKobo)}</dd>
              </div>
            </motion.dl>
          )}
        </AnimatePresence>

        {q?.allowDeposit ? (
          <div role="radiogroup" aria-label="How would you like to pay?" className="grid gap-2">
            {(
              [
                { v: "FULL", t: "Pay in full", d: formatNaira(q.totalKobo) },
                { v: "DEPOSIT", t: `Pay ${q.depositPct}% deposit now`, d: `${formatNaira(deposit)} now · ${formatNaira(q.totalKobo - deposit)} before delivery` },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={plan === o.v}
                disabled={!!busy}
                onClick={() => setPlan(o.v)}
                className={cn("rounded-2xl border-2 p-3 text-left text-sm transition-colors", plan === o.v ? "border-brand-600 bg-brand-50" : "border-ink-200 hover:border-ink-300")}
              >
                <span className="block font-semibold">{o.t}</span>
                <span className="block text-ink-500">{o.d}</span>
              </button>
            ))}
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={!!busy} disabled={!q} icon={<Lock className="size-4" />}>
          {busy === "creating" ? "Booking your truck…" : busy === "paying" ? "Opening Paystack…" : q ? `Pay ${formatNaira(payNow)}` : "Set both locations"}
        </Button>
        <div className="space-y-2 text-xs text-ink-400">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-success-600" /> Card details are entered on Paystack — we never see them.</p>
          <p>We email you a private booking link to track the job and pay any balance.</p>
        </div>
      </aside>
    </form>
  );
}

function Card({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step * 0.06 }} className="rounded-3xl bg-white p-6 ring-1 ring-ink-900/5 sm:p-8">
      <h2 className="font-display mb-6 flex items-center gap-3 text-xl font-bold">
        <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-sm text-white">{step}</span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-ink-500">{icon}{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
