"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRightLeft, Loader2, MapPin, Navigation, Route } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select, Textarea } from "@/components/ui/Field";
import { ApiError, fetchJson } from "@/lib/client/fetch-json";
import { formatNaira } from "@/lib/money";
import type { LatLng } from "@/components/maps/LocationPicker";

const LocationPicker = dynamic(() => import("@/components/maps/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="skeleton h-[22rem] rounded-2xl" />,
});

export interface StateOption {
  code: string;
  label: string;
  areas: { code: string; label: string }[];
}

type Method = "AREA" | "STATE" | "DISTANCE" | "ESTIMATE";

export interface DeliveryQuoteResult {
  token: string;
  totalKobo: number;
  containerCount: number;
  method: Method;
  stateCode: string;
  stateLabel: string;
  areaCode: string | null;
  areaLabel: string | null;
  distanceKm: number | null;
  yard: string | null;
  perSize: Record<string, number>;
}

type QuoteResponse =
  | ({ ok: true } & DeliveryQuoteResult)
  | { ok: false; code: "QUOTE_REQUIRED" | "STATE_MISMATCH" | "NEED_STATE" | "INVALID_ZONE"; message: string; stateCode?: string; stateLabel?: string };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; quote: DeliveryQuoteResult }
  | { kind: "problem"; res: Exclude<QuoteResponse, { ok: true }> }
  | { kind: "error"; message: string };

const OTHER = "__OTHER";

interface Props {
  states: StateOption[];
  items: { containerId: string; quantity: number }[];
  disabled?: boolean;
  errors: Record<string, string>;
  /** Bump to force a fresh quote (e.g. after checkout says it expired). */
  refreshKey: number;
  onQuote: (q: DeliveryQuoteResult | null) => void;
}

export function DeliveryPicker({ states, items, disabled, errors, refreshKey, onQuote }: Props) {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [stateCode, setStateCode] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [autoState, setAutoState] = useState(false);
  const autoStateRef = useRef(autoState);
  autoStateRef.current = autoState;
  const onQuoteRef = useRef(onQuote);
  onQuoteRef.current = onQuote;

  const state = states.find((s) => s.code === stateCode);
  const itemsKey = JSON.stringify(items);
  // The (state, area) a quote came back for, so adopting a detected state doesn't re-request.
  const resolvedKey = useRef<string>("");

  const keyFor = (s: string) => JSON.stringify({ pin, s, areaCode, itemsKey, refreshKey, attempt });
  const requestKey = useMemo(() => JSON.stringify({ pin, s: stateCode, areaCode, itemsKey, refreshKey, attempt }), [pin, stateCode, areaCode, itemsKey, refreshKey, attempt]);

  useEffect(() => {
    if (!pin) {
      setStatus({ kind: "idle" });
      onQuoteRef.current(null);
      return;
    }
    if (requestKey === resolvedKey.current) return;
    let cancelled = false;
    setStatus({ kind: "loading" });
    onQuoteRef.current(null);
    const t = setTimeout(async () => {
      try {
        const res = await fetchJson<QuoteResponse>("/api/delivery/quote", {
          method: "POST",
          json: { lat: pin.lat, lng: pin.lng, stateCode: stateCode || null, areaCode: areaCode && areaCode !== OTHER ? areaCode : null, items: JSON.parse(itemsKey) },
          retries: 2,
          timeoutMs: 20_000,
        });
        if (cancelled) return;
        if (res.ok) {
          // Adopt the state the server detected from the pin.
          if (!stateCode && res.stateCode) {
            resolvedKey.current = keyFor(res.stateCode);
            setStateCode(res.stateCode);
            setAutoState(true);
          } else {
            resolvedKey.current = requestKey;
          }
          setStatus({ kind: "ok", quote: res });
          onQuoteRef.current(res);
        } else if (res.code === "STATE_MISMATCH" && res.stateCode && autoStateRef.current) {
          // We picked the state from the pin, and the pin has moved: just follow it.
          setStateCode(res.stateCode);
          setAreaCode("");
        } else {
          resolvedKey.current = requestKey;
          setStatus({ kind: "problem", res });
        }
      } catch (err) {
        if (cancelled) return;
        resolvedKey.current = "";
        setStatus({ kind: "error", message: err instanceof ApiError ? err.message : "We couldn't price this delivery — check your connection and try again." });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  function changeState(code: string) {
    setAutoState(false);
    setStateCode(code);
    setAreaCode("");
  }

  const pinError = errors.deliveryQuote;

  return (
    <div className="grid gap-5 pt-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-700">
          Delivery location <span className="text-accent-500">*</span>
        </p>
        <p className="mb-3 text-xs text-ink-500">Search your address or tap the map, then drag the pin to the exact site entrance — our driver navigates to this pin.</p>
        <LocationPicker value={pin} onChange={(p) => setPin(p)} disabled={disabled} />
        {pinError && !pin ? <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">{pinError}</p> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="State" required value={stateCode} onChange={(e) => changeState(e.target.value)} disabled={disabled} hint={autoState && stateCode ? "Filled in from your pin — change it if it's wrong" : undefined}>
          <option value="">{pin && !stateCode && status.kind === "loading" ? "Detecting from your pin…" : "Select state…"}</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </Select>
        {state?.areas.length ? (
          <Select label="Area" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} disabled={disabled}>
            <option value="">Select area…</option>
            {state.areas.map((a) => (
              <option key={a.code} value={a.code}>{a.label}</option>
            ))}
            <option value={OTHER}>Other area in {state.label}</option>
          </Select>
        ) : null}
      </div>

      <QuotePanel status={status} onSwitchState={changeState} onRetry={() => setAttempt((n) => n + 1)} />

      <Textarea name="deliveryAddress" label="Address & directions" required rows={3} maxLength={500} error={errors.deliveryAddress} disabled={disabled} placeholder="House / plot number, street, estate, nearest landmark, gate colour…" />
    </div>
  );
}

function QuotePanel({ status, onSwitchState, onRetry }: { status: Status; onSwitchState: (code: string) => void; onRetry: () => void }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {status.kind === "loading" ? (
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
          <Loader2 className="size-4 animate-spin" /> Pricing delivery to your pin…
        </motion.div>
      ) : status.kind === "ok" ? (
        <motion.div key={`ok-${status.quote.token.slice(-12)}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm ring-1 ring-brand-500/20">
          {status.quote.method === "DISTANCE" || status.quote.method === "ESTIMATE" ? <Route className="mt-0.5 size-5 shrink-0 text-brand-600" /> : <MapPin className="mt-0.5 size-5 shrink-0 text-brand-600" />}
          <div className="flex-1">
            <p className="font-semibold text-ink-900">
              Delivery fee: {formatNaira(status.quote.totalKobo)}
              {status.quote.containerCount > 1 ? <span className="font-normal text-ink-500"> · {status.quote.containerCount} containers</span> : null}
            </p>
            <p className="text-ink-600">{describe(status.quote)}</p>
          </div>
        </motion.div>
      ) : status.kind === "problem" ? (
        <motion.div key={`p-${status.res.code}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-3 rounded-2xl bg-warning-100 p-4 text-sm text-warning-600">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-ink-900">{status.res.message}</p>
            {status.res.code === "STATE_MISMATCH" && status.res.stateCode ? (
              <button type="button" onClick={() => onSwitchState(status.res.stateCode!)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-semibold text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50">
                <ArrowRightLeft className="size-4" /> Switch to {status.res.stateLabel}
              </button>
            ) : null}
            {status.res.code === "QUOTE_REQUIRED" ? (
              <p className="text-ink-600">
                <a href="/contact" className="font-semibold text-brand-600 underline underline-offset-2">Ask us for a delivery quote</a> — or choose <strong>Pick up at terminal</strong> above to pay for your container now.
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : status.kind === "error" ? (
        <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="flex items-center gap-3 rounded-2xl bg-danger-100 p-4 text-sm text-danger-600">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{status.message}</span>
          <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-ink-900 ring-1 ring-ink-200">Retry</button>
        </motion.div>
      ) : (
        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-4 text-sm text-ink-500">
          <Navigation className="size-4" /> Drop your pin to see the delivery price.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function describe(q: DeliveryQuoteResult) {
  const place = q.areaLabel ? `${q.areaLabel}, ${q.stateLabel}` : q.stateLabel;
  switch (q.method) {
    case "AREA":
    case "STATE":
      return `Fixed rate for ${place}.`;
    case "DISTANCE":
      return `${Math.round(q.distanceKm ?? 0)} km by road from our ${q.yard ?? "yard"} · ${place}.`;
    case "ESTIMATE":
      return `About ${Math.round(q.distanceKm ?? 0)} km from our ${q.yard ?? "yard"} · ${place}.`;
  }
}
