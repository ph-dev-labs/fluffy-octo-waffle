"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Download, Loader2, MapPin, Plus, Search, Trash2, Upload } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { addAreaAction, deleteAreaAction, importZonesCsvAction, saveDeliverySettingsAction, saveZoneAction } from "@/app/admin/actions/delivery";
import { initialState, type ActionState } from "@/app/admin/actions/types";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { CONTAINER_SIZES, distanceFeeKobo, type Yard } from "@/lib/delivery/calc";
import { ApiError, fetchJson } from "@/lib/client/fetch-json";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ConfirmSubmit, FormMessage, SubmitButton } from "../ui";

const LocationPicker = dynamic(() => import("@/components/maps/LocationPicker").then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="skeleton h-[22rem] rounded-2xl" />,
});

const SIZE_LABEL: Record<string, string> = { "20FT": "20ft", "40FT": "40ft", "40HC": "40ft High Cube", "45HC": "45ft High Cube" };

// ── Distance pricing settings ──────────────────────────────────────────────

export interface SettingsValues {
  distanceEnabled: boolean;
  yards: Yard[];
  baseFeeKobo: number;
  ratePerKmKobo: number;
  minFeeKobo: number;
  maxFeeKobo: number;
  maxDistanceKm: number;
  roadFactorPct: number;
  sizeMultipliers: Record<string, number>;
  routing: boolean;
}

export function DeliverySettingsForm({ settings }: { settings: SettingsValues }) {
  const [state, action] = useActionState(saveDeliverySettingsAction, initialState);
  const f = state.fields ?? {};
  const [yards, setYards] = useState<Yard[]>(settings.yards.length ? settings.yards : [{ name: "Main yard", lat: NaN, lng: NaN }]);
  const [selected, setSelected] = useState(0);
  const [v, setV] = useState({
    baseFee: settings.baseFeeKobo / 100,
    ratePerKm: settings.ratePerKmKobo / 100,
    minFee: settings.minFeeKobo / 100,
    maxFee: settings.maxFeeKobo / 100,
  });
  const num = (k: keyof typeof v) => ({
    name: k,
    type: "number" as const,
    min: 0,
    step: "1",
    value: Number.isFinite(v[k]) ? v[k] : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.valueAsNumber })),
    error: f[k],
  });

  const examples = [10, 50, 150, 400, 800].map((km) => ({
    km,
    fee: distanceFeeKobo(km, { baseFeeKobo: (v.baseFee || 0) * 100, ratePerKmKobo: (v.ratePerKm || 0) * 100, minFeeKobo: (v.minFee || 0) * 100, maxFeeKobo: (v.maxFee || 0) * 100 }),
  }));
  const sel = yards[selected];
  const hasPoint = (y?: Yard) => !!y && Number.isFinite(y.lat) && Number.isFinite(y.lng);

  return (
    <form action={action} className="space-y-6">
      <label className="flex items-start gap-3 rounded-xl bg-ink-50 p-4 text-sm">
        <input type="checkbox" name="distanceEnabled" defaultChecked={settings.distanceEnabled} className="mt-0.5 size-4 accent-brand-600" />
        <span>
          <span className="font-semibold">Price by distance when a state or area has no fixed rate</span>
          <span className="block text-ink-500">Off: customers in unpriced states are asked to contact you for a quote instead of paying online.</span>
        </span>
      </label>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Yards (where trucks leave from)</h3>
        <p className="mb-3 text-xs text-ink-500">Distance is measured from the nearest yard. Select a yard, then tap the map (or search) to set its location.</p>
        <input type="hidden" name="yardCount" value={yards.length} />
        <div className="mb-3 space-y-2">
          {yards.map((y, i) => (
            <div key={i} className={cn("flex flex-wrap items-center gap-2 rounded-xl p-2 ring-1", i === selected ? "bg-brand-50 ring-brand-500/40" : "ring-ink-100")}>
              <input type="hidden" name={`yard_lat_${i}`} value={Number.isFinite(y.lat) ? y.lat : ""} />
              <input type="hidden" name={`yard_lng_${i}`} value={Number.isFinite(y.lng) ? y.lng : ""} />
              <button type="button" onClick={() => setSelected(i)} className={cn("grid size-9 place-items-center rounded-lg", i === selected ? "bg-[#192440] text-white" : "bg-ink-100 text-ink-500")} aria-label={`Set ${y.name || "yard"} on the map`}>
                <MapPin className="size-4" />
              </button>
              <input
                name={`yard_name_${i}`}
                value={y.name}
                onChange={(e) => setYards((ys) => ys.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                onFocus={() => setSelected(i)}
                placeholder="Yard name, e.g. Apapa yard"
                className="h-9 min-w-40 flex-1 rounded-lg border border-ink-200 px-3 text-sm outline-none focus:border-brand-500"
              />
              <span className="font-mono text-xs text-ink-500">{hasPoint(y) ? `${y.lat.toFixed(4)}, ${y.lng.toFixed(4)}` : "not on map yet"}</span>
              {yards.length > 1 ? (
                <button type="button" onClick={() => { setYards((ys) => ys.filter((_, k) => k !== i)); setSelected(0); }} className="grid size-9 place-items-center rounded-lg text-danger-600 hover:bg-danger-100" aria-label="Remove yard">
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              {f[`yard_${i}`] ? <p className="w-full text-xs font-medium text-danger-600">{f[`yard_${i}`]}</p> : null}
            </div>
          ))}
          {yards.length < 10 ? (
            <button type="button" onClick={() => { setYards((ys) => [...ys, { name: "", lat: NaN, lng: NaN }]); setSelected(yards.length); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
              <Plus className="size-4" /> Add another yard
            </button>
          ) : null}
        </div>
        <LocationPicker
          value={hasPoint(sel) ? { lat: sel!.lat, lng: sel!.lng } : null}
          onChange={(p) => setYards((ys) => ys.map((x, k) => (k === selected ? { ...x, ...p } : x)))}
          markers={yards.filter((y, i) => i !== selected && hasPoint(y)).map((y) => ({ lat: y.lat, lng: y.lng, label: y.name || "Yard" }))}
          initialCenter={hasPoint(sel) ? undefined : { lat: 6.45, lng: 3.39 }}
          initialZoom={10}
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Formula (per 20ft container)</h3>
        <p className="mb-3 text-xs text-ink-500">Fee = base + (road km × rate), kept between the minimum and maximum, rounded to the nearest ₦1,000.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="Base fee (₦)" required {...num("baseFee")} />
          <Input label="Rate per km (₦)" required {...num("ratePerKm")} />
          <Input label="Minimum (₦)" required {...num("minFee")} />
          <Input label="Maximum (₦)" required {...num("maxFee")} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((e) => (
            <span key={e.km} className="rounded-lg bg-ink-50 px-2.5 py-1 text-xs text-ink-600">
              {e.km} km → <strong className="text-ink-900">{formatNaira(e.fee)}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="maxDistanceKm" type="number" min={1} label="Furthest distance priced online (km)" required defaultValue={settings.maxDistanceKm} error={f.maxDistanceKm} hint="Further than this → customer is asked to contact you for a quote." />
        <Input
          name="roadFactorPct"
          type="number"
          min={100}
          max={250}
          label="Straight-line → road estimate (%)"
          required
          defaultValue={settings.roadFactorPct}
          error={f.roadFactorPct}
          hint={settings.routing ? "Only used if the route service is down (real road distance is used otherwise)." : "No route service key set, so distance = straight line × this %."}
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Container size adjustment</h3>
        <p className="mb-3 text-xs text-ink-500">Applied to every delivery price — fixed state/area rates and distance prices. 100% = same as a 20ft.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {CONTAINER_SIZES.map((s) => (
            <Input key={s} name={`m_${s}`} type="number" min={10} max={1000} label={`${SIZE_LABEL[s]} (%)`} required defaultValue={settings.sizeMultipliers[s] ?? 100} error={f[`m_${s}`]} />
          ))}
        </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Save distance pricing</SubmitButton>
    </form>
  );
}

// ── Test a location ────────────────────────────────────────────────────────

export interface ZoneTreeState {
  id: string;
  code: string;
  label: string;
  perContainerKobo: number | null;
  active: boolean;
  areas: { id: string; code: string; label: string; perContainerKobo: number | null; active: boolean }[];
}

type TestResult =
  | { ok: true; method: string; stateLabel: string; areaLabel: string | null; distanceKm: number | null; yard: string | null; perSize: Record<string, number> }
  | { ok: false; code: string; message: string };

export function DeliveryTester({ states }: { states: ZoneTreeState[] }) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [stateCode, setStateCode] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const state = states.find((s) => s.code === stateCode);

  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    setLoading(true);
    fetchJson<TestResult>("/api/delivery/quote", { method: "POST", json: { ...pin, stateCode: stateCode || null, areaCode: areaCode || null }, timeoutMs: 20_000 })
      .then((r) => !cancelled && setResult(r))
      .catch((err) => !cancelled && setResult({ ok: false, code: "ERROR", message: err instanceof ApiError ? err.message : "Couldn't reach the server." }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pin, stateCode, areaCode]);

  const method: Record<string, string> = {
    AREA: "Fixed area rate",
    STATE: "Fixed state rate",
    DISTANCE: "Distance (real road route)",
    ESTIMATE: "Distance (straight-line estimate)",
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <LocationPicker value={pin} onChange={setPin} />
      <div className="space-y-4">
        <Select label="State (optional)" value={stateCode} onChange={(e) => { setStateCode(e.target.value); setAreaCode(""); }} hint="Leave blank to detect it from the pin.">
          <option value="">Detect from pin</option>
          {states.filter((s) => s.active).map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </Select>
        {state?.areas.length ? (
          <Select label="Area" value={areaCode} onChange={(e) => setAreaCode(e.target.value)}>
            <option value="">Other / not listed</option>
            {state.areas.filter((a) => a.active).map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
          </Select>
        ) : null}
        <div className="min-h-32 rounded-xl bg-ink-50 p-4 text-sm">
          {!pin ? (
            <p className="text-ink-500">Drop a pin to see exactly what a customer would be charged there.</p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-ink-500"><Loader2 className="size-4 animate-spin" /> Pricing…</p>
          ) : result?.ok ? (
            <div className="space-y-2">
              <p className="font-semibold">{result.areaLabel ? `${result.areaLabel}, ` : ""}{result.stateLabel}</p>
              <p className="text-ink-600">
                {method[result.method] ?? result.method}
                {result.distanceKm != null ? ` · ${Math.round(result.distanceKm)} km from ${result.yard}` : ""}
              </p>
              <dl className="space-y-1 border-t border-ink-200 pt-2">
                {CONTAINER_SIZES.map((s) => (
                  <div key={s} className="flex justify-between"><dt className="text-ink-500">{SIZE_LABEL[s]}</dt><dd className="font-semibold tabular-nums">{formatNaira(result.perSize[s] ?? 0)}</dd></div>
                ))}
              </dl>
            </div>
          ) : result ? (
            <p className="text-warning-600"><strong>{result.code === "QUOTE_REQUIRED" ? "Customer must ask for a quote: " : ""}</strong>{result.message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── States & areas ─────────────────────────────────────────────────────────

const priceValue = (kobo: number | null) => (kobo == null ? "" : String(kobo / 100));

function rule(state: ZoneTreeState, distanceEnabled: boolean) {
  if (state.perContainerKobo != null) return `Fixed ${formatNaira(state.perContainerKobo)}`;
  return distanceEnabled ? "By distance" : "Quote by hand";
}

export function ZoneTree({ states, distanceEnabled }: { states: ZoneTreeState[]; distanceEnabled: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return states;
    return states.filter((s) => s.label.toLowerCase().includes(t) || s.areas.some((a) => a.label.toLowerCase().includes(t)));
  }, [q, states]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a state or area…" className="h-11 w-full rounded-xl border border-ink-200 pr-3 pl-10 text-sm outline-none focus:border-brand-500" />
      </div>
      <ul className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-100">
        {shown.map((s) => {
          const isOpen = open === s.id || (!!q.trim() && s.areas.some((a) => a.label.toLowerCase().includes(q.trim().toLowerCase())));
          const priced = s.areas.filter((a) => a.perContainerKobo != null).length;
          return (
            <li key={s.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50">
                <span className={cn("size-2 shrink-0 rounded-full", s.active ? "bg-success-600" : "bg-ink-300")} aria-hidden />
                <span className="flex-1 font-semibold">{s.label}</span>
                <span className={cn("rounded-md px-2 py-0.5 text-xs", s.perContainerKobo != null ? "bg-brand-50 text-brand-600" : "bg-ink-100 text-ink-600")}>{s.active ? rule(s, distanceEnabled) : "Off"}</span>
                <span className="hidden w-28 text-right text-xs text-ink-400 sm:block">{s.areas.length ? `${s.areas.length} area${s.areas.length === 1 ? "" : "s"}${priced ? ` · ${priced} priced` : ""}` : "No areas"}</span>
                <ChevronDown className={cn("size-4 text-ink-400 transition-transform", isOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-4 bg-ink-50/60 px-4 pt-1 pb-5">
                      <ZoneRow zone={s} kind="STATE" placeholder={distanceEnabled ? "Blank = price by distance" : "Blank = quote by hand"} />
                      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-ink-100">
                        <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Areas in {s.label}</p>
                        {s.areas.length ? (
                          visibleAreas(s, q).map((a) => <ZoneRow key={a.id} zone={a} kind="AREA" placeholder={s.perContainerKobo != null ? `Blank = ${s.label} rate (${formatNaira(s.perContainerKobo)})` : distanceEnabled ? "Blank = price by distance" : "Blank = quote by hand"} />)
                        ) : (
                          <p className="text-sm text-ink-500">No areas yet — everywhere in {s.label} uses the state rule above.</p>
                        )}
                        <AddAreaForm stateId={s.id} stateLabel={s.label} />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
        {!shown.length ? <li className="px-4 py-6 text-sm text-ink-500">No state or area matches “{q}”.</li> : null}
      </ul>
    </div>
  );
}

/** While searching, only the areas that match (or all of them if the state itself matched). */
function visibleAreas(s: ZoneTreeState, q: string) {
  const t = q.trim().toLowerCase();
  if (!t || s.label.toLowerCase().includes(t)) return s.areas;
  return s.areas.filter((a) => a.label.toLowerCase().includes(t));
}

function ZoneRow({ zone, kind, placeholder }: { zone: { id: string; label: string; perContainerKobo: number | null; active: boolean }; kind: "STATE" | "AREA"; placeholder: string }) {
  const [state, action] = useActionState(saveZoneAction.bind(null, zone.id), initialState);
  const f = state.fields ?? {};
  return (
    <div className="flex items-start gap-2">
      <form action={action} className="grid flex-1 items-start gap-2 sm:grid-cols-[1fr_220px_auto_auto]">
        {kind === "AREA" ? (
          <input name="label" defaultValue={zone.label} aria-label="Area name" className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm outline-none focus:border-brand-500" />
        ) : (
          <p className="pt-2.5 text-sm font-medium">Rate for all of {zone.label}</p>
        )}
        <div>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-400">₦</span>
            <input name="price" inputMode="decimal" defaultValue={priceValue(zone.perContainerKobo)} placeholder={placeholder} aria-label={`Price per 20ft for ${zone.label}`} aria-invalid={!!f.price || undefined} className={cn("h-10 w-full rounded-lg border bg-white pr-2 pl-7 text-sm tabular-nums outline-none focus:border-brand-500 placeholder:text-xs", f.price ? "border-danger-600" : "border-ink-200")} />
          </div>
          {f.price ? <p className="mt-1 text-xs text-danger-600">{f.price}</p> : null}
        </div>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={zone.active} className="size-4 accent-brand-600" /> On</label>
        <SubmitButton variant="secondary" pendingText="…">Save</SubmitButton>
        {state.message && !state.ok ? <p className="text-xs text-danger-600 sm:col-span-4">{state.message}</p> : null}
        <SilentSuccess state={state} />
      </form>
      {kind === "AREA" ? (
        <form action={deleteAreaAction.bind(null, zone.id)}>
          <ConfirmSubmit message={`Remove the area "${zone.label}"? Customers there will use the state rule instead.`}><Trash2 className="size-4" /></ConfirmSubmit>
        </form>
      ) : null}
    </div>
  );
}

/** Toast on success without an inline message (keeps the rows compact). */
function SilentSuccess({ state }: { state: ActionState }) {
  return <div className="hidden"><FormMessage state={state.ok ? state : initialState} /></div>;
}

function AddAreaForm({ stateId, stateLabel }: { stateId: string; stateLabel: string }) {
  const [state, action] = useActionState(addAreaAction.bind(null, stateId), initialState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const f = state.fields ?? {};
  return (
    <form ref={ref} action={action} className="grid items-start gap-2 border-t border-ink-100 pt-3 sm:grid-cols-[1fr_220px_auto]">
      <div>
        <input name="label" placeholder={`New area in ${stateLabel}, e.g. Ikorodu`} aria-label="New area name" className={cn("h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand-500", f.label ? "border-danger-600" : "border-ink-200")} />
        {f.label ? <p className="mt-1 text-xs text-danger-600">{f.label}</p> : null}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-400">₦</span>
        <input name="price" inputMode="decimal" placeholder="Price (blank = inherit)" aria-label="New area price per 20ft" className="h-10 w-full rounded-lg border border-ink-200 bg-white pr-2 pl-7 text-sm outline-none focus:border-brand-500 placeholder:text-xs" />
      </div>
      <SubmitButton pendingText="Adding…"><Plus className="size-4" /> Add area</SubmitButton>
      {state.message && !state.ok ? <p className="text-xs text-danger-600 sm:col-span-3">{state.message}</p> : null}
      <SilentSuccess state={state} />
    </form>
  );
}

// ── CSV import / export ────────────────────────────────────────────────────

export function ZoneCsv({ states }: { states: ZoneTreeState[] }) {
  const [state, action] = useActionState(importZonesCsvAction, initialState);
  // Controlled so a rejected import doesn't wipe what was pasted.
  const [csv, setCsv] = useState("");
  useEffect(() => {
    if (state.ok) setCsv("");
  }, [state]);

  function exportCsv() {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = [["State", "Area", "Price per 20ft (NGN)"]];
    for (const s of states) {
      rows.push([s.label, "", priceValue(s.perContainerKobo)]);
      for (const a of s.areas) rows.push([s.label, a.label, priceValue(a.perContainerKobo)]);
    }
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "delivery-prices.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-ink-500">
        One row per price: <span className="font-mono text-ink-700">State,Area,Price</span>. Leave Area blank to set the state rate; leave Price blank to clear it. New areas are created automatically. Tip: export the current prices, edit them in Excel or Google Sheets, then import.
      </p>
      <Textarea name="csv" label="Paste rows" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"State,Area,Price\nLagos,,150000\nLagos,Lekki,220000\nLagos,Ikorodu,180000\nOgun,Sango Ota,250000"} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
          <Upload className="size-4" /> Or choose a .csv file
          <input type="file" name="file" accept=".csv,text/csv" className="sr-only" />
        </label>
        <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-ink-200 hover:bg-ink-50">
          <Download className="size-4" /> Export current prices
        </button>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Importing…">Import prices</SubmitButton>
    </form>
  );
}
