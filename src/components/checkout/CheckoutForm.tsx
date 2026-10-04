"use client";

import Image from "@/components/ui/SmartImage";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Building2, Lock, MapPin, RotateCw, ShieldCheck, Truck, WifiOff } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Honeypot, Input, Select, Textarea } from "@/components/ui/Field";
import { ApiError, fetchJson, NetworkError } from "@/lib/client/fetch-json";
import { openPaystack } from "@/lib/client/paystack";
import { idempotencyKeyFor, resetIdempotencyKey, savePending } from "@/lib/client/pending-payment";
import { useCartPricing } from "@/lib/client/use-cart-pricing";
import { formatNaira } from "@/lib/money";
import { deliveryFeeKobo, type ZoneOption } from "@/lib/pricing";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

interface CheckoutResponse {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
  amountKobo: number;
}

type Stage = "form" | "creating" | "paying";

export function CheckoutForm({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const { data, loading, error: pricingError, retry, items } = useCartPricing();
  const [fulfilment, setFulfilment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [zone, setZone] = useState("");
  const selectedZone = zones.find((z) => z.code === zone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>("form");
  const [banner, setBanner] = useState<{ tone: "error" | "offline"; text: string } | null>(null);
  const submitting = useRef(false);

  const available = useMemo(() => data?.lines.filter((l) => l.available && (l.quantity ?? 0) > 0) ?? [], [data]);
  const containerCount = available.reduce((n, l) => n + (l.quantity ?? 0), 0);
  const deliveryKobo = fulfilment === "DELIVERY" ? deliveryFeeKobo(selectedZone, containerCount) : 0;
  const totalKobo = (data?.subtotalKobo ?? 0) + deliveryKobo;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return; // hard guard against double submit
    setBanner(null);

    const fd = new FormData(e.currentTarget);
    const base = {
      items: available.map((l) => ({ containerId: l.containerId, quantity: l.quantity! })),
      customer: {
        fullName: String(fd.get("fullName") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        companyName: String(fd.get("companyName") ?? ""),
      },
      fulfilment,
      deliveryZone: fulfilment === "DELIVERY" && zone ? zone : undefined,
      deliveryAddress: fulfilment === "DELIVERY" ? String(fd.get("deliveryAddress") ?? "") : "",
      website: String(fd.get("website") ?? ""),
    };

    // Same payload ⇒ same idempotency key ⇒ retries can never create a 2nd charge.
    const fingerprint = JSON.stringify(base);
    const payload = { ...base, idempotencyKey: idempotencyKeyFor(fingerprint) };

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setErrors({});
    submitting.current = true;
    setStage("creating");

    try {
      const res = await createWithRecovery(payload, fingerprint);
      savePending({ reference: res.reference, amountKobo: res.amountKobo, accessCode: res.accessCode, authorizationUrl: res.authorizationUrl });
      setStage("paying");

      const statusUrl = `/checkout/status?reference=${encodeURIComponent(res.reference)}`;
      await openPaystack({
        accessCode: res.accessCode,
        authorizationUrl: res.authorizationUrl,
        onSuccess: () => router.push(statusUrl),
        onCancel: () => router.push(`${statusUrl}&cancelled=1`),
        onError: () => router.push(statusUrl),
      });
    } catch (err) {
      setStage("form");
      handleError(err);
    } finally {
      submitting.current = false;
    }
  }

  async function createWithRecovery(payload: Record<string, unknown>, fingerprint: string): Promise<CheckoutResponse> {
    try {
      return await fetchJson<CheckoutResponse>("/api/checkout", { method: "POST", json: payload, retries: 3, timeoutMs: 30_000 });
    } catch (err) {
      // The previous attempt for this key ended (failed/abandoned) or the payload drifted:
      // start a clean attempt with a fresh key — exactly once.
      if (err instanceof ApiError && (err.code === "ORDER_CLOSED" || err.code === "IDEMPOTENCY_KEY_REUSED")) {
        resetIdempotencyKey();
        const fresh = { ...payload, idempotencyKey: idempotencyKeyFor(fingerprint) };
        return fetchJson<CheckoutResponse>("/api/checkout", { method: "POST", json: fresh, retries: 3, timeoutMs: 30_000 });
      }
      throw err;
    }
  }

  function handleError(err: unknown) {
    if (err instanceof NetworkError) {
      setBanner({ tone: "offline", text: `${err.message} You have not been charged. Your details are saved — press Pay again when you're back online.` });
      return;
    }
    if (err instanceof ApiError) {
      if (err.code === "ALREADY_PAID" && err.fields?.reference) {
        router.push(`/checkout/status?reference=${encodeURIComponent(err.fields.reference)}`);
        return;
      }
      if (err.code === "ITEMS_UNAVAILABLE" || err.code === "INSUFFICIENT_STOCK") retry();
      if (err.fields) setErrors(err.fields);
      setBanner({ tone: "error", text: err.message });
      toast.error(err.message);
      return;
    }
    setBanner({ tone: "error", text: "Something went wrong. You have not been charged — please try again." });
  }

  if (loading && !data) return <CheckoutSkeleton />;

  if (pricingError) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-3xl bg-danger-100 p-6 text-danger-600">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5" /> {pricingError}</p>
        <Button variant="secondary" onClick={retry} icon={<RotateCw className="size-4" />}>Try again</Button>
      </div>
    );
  }

  if (!items.length || !available.length) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-white py-20 text-center ring-1 ring-ink-900/5">
        <h2 className="font-display text-2xl font-bold">Nothing to check out</h2>
        <p className="text-ink-500">Your cart is empty or its items are no longer available.</p>
        <ButtonLink href="/browse">Browse containers</ButtonLink>
      </div>
    );
  }

  const busy = stage !== "form";

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

        <Card step={1} title="Contact details">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input name="fullName" label="Full name" required autoComplete="name" error={errors["customer.fullName"]} disabled={busy} />
            <Input name="companyName" label="Company (optional)" autoComplete="organization" error={errors["customer.companyName"]} disabled={busy} />
            <Input name="email" type="email" label="Email" required autoComplete="email" hint="Your receipt is sent here." error={errors["customer.email"]} disabled={busy} />
            <Input name="phone" type="tel" label="Phone" required autoComplete="tel" inputMode="tel" error={errors["customer.phone"]} disabled={busy} />
          </div>
        </Card>

        <Card step={2} title="Pickup or delivery">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fulfilment method">
            {(
              [
                { v: "PICKUP", icon: Building2, t: "Pick up at terminal", d: "Collect from the listed terminal. Free." },
                { v: "DELIVERY", icon: Truck, t: "Deliver to my site", d: "Flatbed delivery nationwide." },
              ] as const
            ).map((o) => {
              const active = fulfilment === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => setFulfilment(o.v)}
                  className={cn("relative flex gap-4 rounded-2xl border-2 p-4 text-left transition-colors", active ? "border-brand-600 bg-brand-50" : "border-ink-200 hover:border-ink-300")}
                >
                  <o.icon className={cn("size-6 shrink-0", active ? "text-brand-600" : "text-ink-400")} />
                  <span>
                    <span className="block font-semibold">{o.t}</span>
                    <span className="block text-sm text-ink-500">{o.d}</span>
                  </span>
                  {active ? <motion.span layoutId="fulfil-dot" className="absolute top-3 right-3 size-3 rounded-full bg-brand-600" /> : null}
                </button>
              );
            })}
          </div>
          <AnimatePresence initial={false}>
            {fulfilment === "DELIVERY" ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-5 pt-5">
                  <Select label="Delivery region" required value={zone} onChange={(e) => setZone(e.target.value)} error={errors.deliveryZone} disabled={busy}>
                    <option value="" disabled>Select region…</option>
                    {zones.map((z) => (
                      <option key={z.code} value={z.code}>
                        {z.label} — {formatNaira(z.perContainerKobo)} / container
                      </option>
                    ))}
                  </Select>
                  <Textarea name="deliveryAddress" label="Full delivery address" required rows={3} maxLength={500} error={errors.deliveryAddress} disabled={busy} placeholder="Street, area, city, state + any landmark" />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Card>
      </div>

      <aside className="h-fit space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-900/5 lg:sticky lg:top-28">
        <h2 className="font-display text-xl font-bold">Order summary</h2>
        <ul className="space-y-4">
          {available.map((l) => (
            <li key={l.containerId} className="flex gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                {l.image ? <Image src={l.image} alt="" fill sizes="56px" className="object-cover" /> : null}
                <span className="absolute top-0.5 right-0.5 grid min-w-5 place-items-center rounded-full bg-ink-900 px-1 text-[10px] leading-5 font-bold text-white">{l.quantity}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.title}</p>
                <p className="text-xs text-ink-500">{l.terminal}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatNaira(l.lineTotalKobo!)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-ink-100 pt-4 text-sm">
          <Row label="Subtotal" value={formatNaira(data!.subtotalKobo)} />
          <Row label={fulfilment === "DELIVERY" ? `Delivery (${containerCount} × container)` : "Pickup"} value={fulfilment === "DELIVERY" ? (zone ? formatNaira(deliveryKobo) : "Select region") : "Free"} />
        </dl>
        <div className="flex items-baseline justify-between border-t border-ink-100 pt-4">
          <span className="font-semibold">Total</span>
          <motion.span key={totalKobo} initial={{ scale: 1.08, color: "#3369ff" }} animate={{ scale: 1, color: "#0a1128" }} className="font-display text-2xl font-bold tabular-nums">
            {formatNaira(totalKobo)}
          </motion.span>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Lock className="size-4" />}>
          {stage === "creating" ? "Securing your order…" : stage === "paying" ? "Opening Paystack…" : `Pay ${formatNaira(totalKobo)}`}
        </Button>
        <div className="space-y-2 text-xs text-ink-400">
          <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-success-600" /> Card details are entered on Paystack — we never see them.</p>
          <p className="flex items-center gap-2"><MapPin className="size-4" /> Final amount is confirmed by our server before payment.</p>
        </div>
      </aside>
    </form>
  );
}

function Card({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step * 0.08 }} className="rounded-3xl bg-white p-6 ring-1 ring-ink-900/5 sm:p-8">
      <h2 className="font-display mb-6 flex items-center gap-3 text-xl font-bold">
        <span className="grid size-8 place-items-center rounded-full bg-ink-900 text-sm text-white">{step}</span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-8">
        <div className="skeleton h-72 rounded-3xl" />
        <div className="skeleton h-48 rounded-3xl" />
      </div>
      <div className="skeleton h-96 rounded-3xl" />
    </div>
  );
}
