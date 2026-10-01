"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Copy, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, fetchJson, NetworkError } from "@/lib/client/fetch-json";
import { openPaystack } from "@/lib/client/paystack";
import { clearPending, readPending, resetIdempotencyKey, type PendingPayment } from "@/lib/client/pending-payment";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/store/cart";
import type { PublicOrder } from "@/lib/payments";
import { Button, ButtonLink } from "@/components/ui/Button";

type View =
  | { kind: "checking" }
  | { kind: "offline" }
  | { kind: "pending"; order: PublicOrder; cancelled: boolean; slow: boolean }
  | { kind: "paid"; order: PublicOrder }
  | { kind: "failed"; order: PublicOrder }
  | { kind: "review"; order: PublicOrder }
  | { kind: "refunded"; order: PublicOrder }
  | { kind: "unknown"; message: string }
  | { kind: "missing" };

// Back-off schedule for polling (ms). After the last entry we keep polling every 30s.
const SCHEDULE = [0, 1500, 2500, 4000, 6000, 9000, 12000, 15000, 20000, 25000];
const SLOW_AFTER_MS = 90_000;
const STOP_AFTER_MS = 15 * 60_000;

const REFERENCE_RE = /^CZ_[A-Z0-9_]{8,48}$/;

export function PaymentStatus() {
  const params = useSearchParams();
  const router = useRouter();
  const clearCart = useCart((s) => s.clear);
  const cancelled = params.get("cancelled") === "1";

  const [reference, setReference] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [view, setView] = useState<View>({ kind: "checking" });
  const [manualTick, setManualTick] = useState(0);
  const attempt = useRef(0);
  const startedAt = useRef(Date.now());

  // Paystack's redirect flow appends ?reference=…&trxref=…; fall back to local pending record.
  useEffect(() => {
    const p = readPending();
    setPending(p);
    const fromUrl = params.get("reference") ?? params.get("trxref");
    const ref = fromUrl && REFERENCE_RE.test(fromUrl) ? fromUrl : p?.reference ?? null;
    setReference(ref);
    if (!ref) setView({ kind: "missing" });
  }, [params]);

  const finalise = useCallback(
    (order: PublicOrder) => {
      switch (order.status) {
        case "PAID":
          clearPending(order.reference);
          resetIdempotencyKey();
          clearCart();
          setView({ kind: "paid", order });
          return true;
        case "FAILED":
          clearPending(order.reference);
          setView({ kind: "failed", order });
          return true;
        case "AMOUNT_MISMATCH":
          clearPending(order.reference);
          setView({ kind: "review", order });
          return true;
        case "REFUNDED":
          clearPending(order.reference);
          setView({ kind: "refunded", order });
          return true;
        default:
          return false;
      }
    },
    [clearCart],
  );

  useEffect(() => {
    if (!reference) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (!navigator.onLine) {
        setView((v) => (v.kind === "paid" ? v : { kind: "offline" }));
        return; // resumed by the 'online' listener
      }
      try {
        const { order } = await fetchJson<{ order: PublicOrder }>(`/api/payments/verify?reference=${encodeURIComponent(reference)}`, { retries: 1, timeoutMs: 20_000 });
        if (stopped) return;
        if (finalise(order)) return;
        const elapsed = Date.now() - startedAt.current;
        setView({ kind: "pending", order, cancelled, slow: elapsed > SLOW_AFTER_MS });
        if (elapsed > STOP_AFTER_MS) return; // server reconciliation takes over from here
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
          setView({ kind: "unknown", message: "We couldn't find a payment with this reference." });
          return;
        }
        if (err instanceof NetworkError) setView((v) => (v.kind === "pending" ? v : { kind: "offline" }));
        // other errors (503 etc.) → keep polling quietly; the payment is safe.
      }
      const delay = SCHEDULE[Math.min(attempt.current + 1, SCHEDULE.length - 1)] ?? 30_000;
      attempt.current += 1;
      timer = setTimeout(tick, attempt.current >= SCHEDULE.length ? 30_000 : delay);
    };

    const onOnline = () => {
      clearTimeout(timer);
      setView((v) => (v.kind === "offline" ? { kind: "checking" } : v));
      tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onOnline();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reference, cancelled, finalise, manualTick]);

  const resume = async () => {
    if (!pending || pending.reference !== reference) return router.push("/checkout");
    await openPaystack({
      accessCode: pending.accessCode,
      authorizationUrl: pending.authorizationUrl,
      onSuccess: () => router.replace(`/checkout/status?reference=${encodeURIComponent(pending.reference)}`),
      onCancel: () => setManualTick((n) => n + 1),
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={view.kind}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4 }}
          className="rounded-[2rem] bg-white p-8 text-center shadow-card ring-1 ring-ink-900/5 sm:p-12"
          role="status"
          aria-live="polite"
        >
          {view.kind === "checking" ? (
            <Spinner title="Confirming your payment…" body="This usually takes a few seconds. Please don't close this page or pay again." />
          ) : view.kind === "offline" ? (
            <>
              <IconBadge tone="warning"><WifiOff className="size-8" /></IconBadge>
              <Title>You&apos;re offline</Title>
              <Body>
                If you completed payment, it&apos;s safe — we confirm it directly with Paystack and will email your receipt. We&apos;ll resume checking as soon as you&apos;re back online.
              </Body>
              <RefLine reference={reference} />
            </>
          ) : view.kind === "pending" ? (
            view.cancelled && !view.slow ? (
              <>
                <IconBadge tone="warning"><AlertTriangle className="size-8" /></IconBadge>
                <Title>Payment not completed</Title>
                <Body>
                  You closed the payment window. If you paid by bank transfer or USSD it may take a few minutes — we&apos;re still checking in the background.
                </Body>
                <Amount kobo={view.order.amountKobo} />
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button onClick={resume}>Resume payment</Button>
                  <ButtonLink href="/cart" variant="secondary">Back to cart</ButtonLink>
                </div>
                <RefLine reference={view.order.reference} />
              </>
            ) : (
              <>
                <Spinner
                  title={view.slow ? "Still waiting for confirmation" : "Confirming your payment…"}
                  body={
                    view.slow
                      ? "Your bank is taking longer than usual. You can safely close this page — we'll confirm automatically and email you. Please do NOT pay again."
                      : "Hang tight, we're confirming with Paystack. Please don't pay again."
                  }
                />
                <Amount kobo={view.order.amountKobo} />
                <RefLine reference={view.order.reference} />
              </>
            )
          ) : view.kind === "paid" ? (
            <Success order={view.order} />
          ) : view.kind === "failed" ? (
            <>
              <IconBadge tone="danger"><AlertTriangle className="size-8" /></IconBadge>
              <Title>Payment failed</Title>
              <Body>Your payment didn&apos;t go through and you have not been charged. You can try again with another card or method.</Body>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <ButtonLink href="/checkout">Try again</ButtonLink>
                <ButtonLink href="/contact" variant="secondary">Contact support</ButtonLink>
              </div>
              <RefLine reference={view.order.reference} />
            </>
          ) : view.kind === "review" ? (
            <>
              <IconBadge tone="warning"><AlertTriangle className="size-8" /></IconBadge>
              <Title>We&apos;re reviewing your payment</Title>
              <Body>We received a payment but it needs a quick manual check. Our team will contact you within one business day — no action needed.</Body>
              <RefLine reference={view.order.reference} />
            </>
          ) : view.kind === "refunded" ? (
            <>
              <IconBadge tone="warning"><RefreshCw className="size-8" /></IconBadge>
              <Title>This payment was refunded</Title>
              <Body>Refunds typically reach your account within 5–10 business days.</Body>
              <RefLine reference={view.order.reference} />
            </>
          ) : view.kind === "unknown" ? (
            <>
              <IconBadge tone="danger"><AlertTriangle className="size-8" /></IconBadge>
              <Title>Payment not found</Title>
              <Body>{view.message} If you were charged, please contact us with your bank alert and we&apos;ll sort it out.</Body>
              <div className="mt-8 flex justify-center gap-3">
                <ButtonLink href="/contact">Contact support</ButtonLink>
              </div>
            </>
          ) : (
            <>
              <Title>No payment in progress</Title>
              <Body>We couldn&apos;t find a recent payment on this device.</Body>
              <div className="mt-8 flex justify-center">
                <ButtonLink href="/browse">Browse containers</ButtonLink>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Success({ order }: { order: PublicOrder }) {
  return (
    <>
      <div className="relative mx-auto mb-6 size-24">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 size-2 rounded-full"
            style={{ background: i % 3 === 0 ? "var(--color-accent-500)" : i % 3 === 1 ? "var(--color-brand-500)" : "var(--color-success-600)" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos((i / 12) * Math.PI * 2) * 70, y: Math.sin((i / 12) * Math.PI * 2) * 70, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1, delay: 0.35, ease: "easeOut" }}
          />
        ))}
        <motion.svg viewBox="0 0 52 52" className="size-24" initial="hidden" animate="show">
          <motion.circle cx="26" cy="26" r="24" fill="none" stroke="var(--color-success-600)" strokeWidth="3" variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.5 } } }} />
          <motion.path d="M15 27l7 7 15-15" fill="none" stroke="var(--color-success-600)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.4, delay: 0.45 } } }} />
        </motion.svg>
      </div>
      <Title>Payment successful</Title>
      <Body>Thank you! A receipt has been sent to {order.email}. Our team will contact you shortly to arrange {order.fulfilment === "DELIVERY" ? "delivery" : "pickup"}.</Body>
      <div className="mt-8 rounded-2xl bg-ink-50 p-5 text-left text-sm">
        <ul className="space-y-2">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>{i.quantity} × {i.title}</span>
              <span className="tabular-nums">{formatNaira(i.unitPriceKobo * i.quantity)}</span>
            </li>
          ))}
          {order.deliveryKobo ? (
            <li className="flex justify-between"><span>Delivery</span><span className="tabular-nums">{formatNaira(order.deliveryKobo)}</span></li>
          ) : null}
        </ul>
        <div className="mt-3 flex justify-between border-t border-ink-200 pt-3 font-semibold">
          <span>Total paid</span>
          <span className="tabular-nums">{formatNaira(order.amountKobo)}</span>
        </div>
      </div>
      <RefLine reference={order.reference} />
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/browse" variant="secondary">Continue shopping</ButtonLink>
        <ButtonLink href="/">Back home</ButtonLink>
      </div>
    </>
  );
}

function Spinner({ title, body }: { title: string; body: string }) {
  return (
    <>
      <div className="relative mx-auto mb-6 grid size-20 place-items-center">
        <motion.span className="absolute inset-0 rounded-full border-4 border-brand-100 border-t-brand-600" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
      </div>
      <Title>{title}</Title>
      <Body>{body}</Body>
    </>
  );
}

function IconBadge({ tone, children }: { tone: "warning" | "danger"; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className={`mx-auto mb-6 grid size-20 place-items-center rounded-full ${tone === "warning" ? "bg-warning-100 text-warning-600" : "bg-danger-100 text-danger-600"}`}
    >
      {children}
    </motion.div>
  );
}

const Title = ({ children }: { children: React.ReactNode }) => <h1 className="font-display text-2xl font-bold sm:text-3xl">{children}</h1>;
const Body = ({ children }: { children: React.ReactNode }) => <p className="mx-auto mt-3 max-w-md text-ink-500">{children}</p>;
const Amount = ({ kobo }: { kobo: number }) => <p className="font-display mt-6 text-3xl font-bold tabular-nums">{formatNaira(kobo)}</p>;

function RefLine({ reference }: { reference: string | null }) {
  if (!reference) return null;
  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-400">
      Reference: <code className="rounded bg-ink-100 px-2 py-0.5 font-mono text-ink-700">{reference}</code>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(reference).then(() => toast.success("Reference copied"), () => {});
        }}
        className="rounded p-1 hover:bg-ink-100"
        aria-label="Copy reference"
      >
        <Copy className="size-3.5" />
      </button>
    </p>
  );
}
