"use client";

import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, fetchJson } from "@/lib/client/fetch-json";
import { cn } from "@/lib/utils";

export interface LatLng {
  lat: number;
  lng: number;
}

interface Place {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange: (p: LatLng, meta?: { label?: string }) => void;
  /** Extra fixed markers (e.g. yards), shown in navy. */
  markers?: (LatLng & { label: string })[];
  disabled?: boolean;
  className?: string;
  /** Where the map opens when there's no pin yet. */
  initialCenter?: LatLng;
  initialZoom?: number;
}

const NIGERIA_CENTER: LatLng = { lat: 9.08, lng: 8.68 };

function pinIcon(Leaflet: typeof L, color: string) {
  return Leaflet.divIcon({
    className: "",
    iconSize: [32, 42],
    iconAnchor: [16, 40],
    html: `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="#fff"/></svg>`,
  });
}

/**
 * Free OpenStreetMap location picker: click/tap or drag the pin, search an
 * address, or use the device location. Leaflet is loaded on the client only.
 */
export function LocationPicker({ value, onChange, markers = [], disabled, className, initialCenter, initialZoom }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const lib = useRef<typeof L | null>(null);
  const extra = useRef<L.LayerGroup | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [ready, setReady] = useState(false);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const Leaflet = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      lib.current = Leaflet;
      const start = value ?? initialCenter ?? NIGERIA_CENTER;
      const m = Leaflet.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 15 : (initialZoom ?? 6));
      // No pin and no preferred spot: show the whole country, whatever the screen size.
      if (!value && !initialCenter) m.fitBounds([[4.3, 2.7], [13.9, 14.6]]);
      Leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => {
        if (disabledRef.current) return;
        onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) });
      });
      // Scroll-zoom only after the user engages, so the page still scrolls past the map.
      m.on("focus click", () => m.scrollWheelZoom.enable());
      m.on("blur mouseout", () => m.scrollWheelZoom.disable());
      extra.current = Leaflet.layerGroup().addTo(m);
      map.current = m;
      // The map may mount inside an expanding panel; re-measure whenever its box changes.
      ro = new ResizeObserver(() => m.invalidateSize());
      ro.observe(box.current);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in sync with `value`.
  useEffect(() => {
    const m = map.current;
    const Leaflet = lib.current;
    if (!ready || !m || !Leaflet) return;
    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      pin.current = Leaflet.marker([value.lat, value.lng], { draggable: !disabled, icon: pinIcon(Leaflet, "#C6A04F"), keyboard: true, title: "Delivery location" }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) });
      });
    } else {
      pin.current.setLatLng([value.lat, value.lng]);
    }
    if (disabled) pin.current.dragging?.disable();
    else pin.current.dragging?.enable();
    // Don't interrupt a search/locate fly-to with a pan.
    if (!flying.current && !m.getBounds().pad(-0.15).contains([value.lat, value.lng])) m.panTo([value.lat, value.lng]);
  }, [value, ready, disabled]);

  // Fixed markers.
  const markersKey = JSON.stringify(markers);
  useEffect(() => {
    const Leaflet = lib.current;
    if (!ready || !Leaflet || !extra.current) return;
    extra.current.clearLayers();
    for (const mk of markers) {
      Leaflet.marker([mk.lat, mk.lng], { icon: pinIcon(Leaflet, "#192440"), title: mk.label, keyboard: false }).bindTooltip(mk.label).addTo(extra.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, ready]);

  const flying = useRef(false);
  function flyTo(p: LatLng, zoom = 16) {
    const m = map.current;
    if (!m) return;
    flying.current = true;
    m.once("moveend", () => (flying.current = false));
    m.flyTo([p.lat, p.lng], zoom, { duration: 0.8 });
  }

  async function search() {
    const term = q.trim();
    if (term.length < 3 || searching) return;
    setSearching(true);
    setHint(null);
    try {
      const { results } = await fetchJson<{ results: Place[] }>(`/api/geo/search?q=${encodeURIComponent(term)}`, { retries: 1, timeoutMs: 12_000 });
      setResults(results);
      if (!results.length) setHint("No match. Try a nearby landmark or area — or just tap the map.");
    } catch (err) {
      setResults(null);
      setHint(err instanceof ApiError ? err.message : "Search is unavailable — tap the map to drop your pin instead.");
    } finally {
      setSearching(false);
    }
  }

  function choose(p: Place) {
    setResults(null);
    setQ(p.label.split(",").slice(0, 2).join(","));
    const at = { lat: round(p.lat), lng: round(p.lng) };
    onChangeRef.current(at, { label: p.label });
    flyTo(at);
    setHint("Pin placed near that address — drag it to the exact gate or site entrance.");
  }

  function locate() {
    if (!navigator.geolocation) return setHint("Your browser can't share its location — search or tap the map.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
        onChangeRef.current(at);
        flyTo(at, 17);
        setHint("Pin placed at your current location — drag it if the site is elsewhere.");
      },
      () => {
        setLocating(false);
        setHint("Couldn't get your location — search or tap the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              disabled={disabled}
              placeholder="Search street, estate or landmark…"
              aria-label="Search for your delivery address"
              className="h-11 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-10 text-[15px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
            />
          </div>
          <button type="button" onClick={search} disabled={disabled || searching || q.trim().length < 3} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            <span className="hidden sm:inline">Search</span>
          </button>
          <button type="button" onClick={locate} disabled={disabled || locating} title="Use my current location" aria-label="Use my current location" className="grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-ink-200 hover:bg-ink-50 disabled:opacity-50">
            {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
          </button>
        </div>
        <AnimatePresence>
          {results?.length ? (
            <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-12 z-[1000] max-h-64 overflow-auto rounded-xl bg-white p-1 shadow-card ring-1 ring-ink-900/10" role="listbox">
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" role="option" aria-selected={false} onClick={() => choose(r)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-50">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    {r.label}
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative overflow-hidden rounded-2xl ring-1 ring-ink-200">
        <div ref={box} className="z-0 h-72 w-full bg-ink-100 sm:h-80" aria-label="Map — tap to place your delivery pin" />
        {!ready ? <div className="skeleton absolute inset-0" /> : null}
        {ready && !value ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
            <span className="rounded-full bg-ink-900/85 px-3 py-1.5 text-xs font-medium text-white shadow">Tap the map to drop your pin</span>
          </div>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
