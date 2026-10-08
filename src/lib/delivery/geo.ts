import "server-only";
import { logger } from "@/lib/logger";
import { site } from "@/content/site";
import type { Yard } from "./calc";

// Free map services, called from the server only:
//  - Nominatim (OpenStreetMap): address search + "which state is this pin in".
//    Policy: identify the app, ≤ 1 request/second, no keystroke autocomplete.
//  - OpenRouteService (optional, ORS_API_KEY): real truck driving distance.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = `C-ZUCHI-Website/1.0 (${process.env.MAIL_ADMIN_TO || site.email})`;

// Small in-memory TTL cache: repeated pins/searches don't hit the free APIs again.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 6 * 60 * 60_000;
function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
}
function remember<T>(key: string, value: T): T {
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Keep to Nominatim's 1 req/s per instance.
let nextSlot = 0;
async function nominatim(path: string) {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
  state: string | null;
}

export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  const key = `s:${q.toLowerCase()}`;
  const hit = cached<PlaceResult[]>(key);
  if (hit) return hit;
  const data = (await nominatim(`/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ng&q=${encodeURIComponent(q)}`)) as {
    display_name: string;
    lat: string;
    lon: string;
    address?: { state?: string };
  }[];
  return remember(
    key,
    data.map((d) => ({ label: d.display_name.replace(/, Nigeria$/, ""), lat: Number(d.lat), lng: Number(d.lon), state: d.address?.state ?? null })),
  );
}

export const OUTSIDE_NIGERIA = "__OUTSIDE_NIGERIA__";

/** The state a pin falls in (OSM name, e.g. "Lagos State"), OUTSIDE_NIGERIA, or null if unknown / lookup failed. */
export async function reverseState(lat: number, lng: number): Promise<string | null> {
  const key = `r:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cached<string | null>(key);
  if (hit !== undefined) return hit;
  try {
    const d = (await nominatim(`/reverse?format=jsonv2&zoom=8&addressdetails=1&lat=${lat}&lon=${lng}`)) as { address?: { state?: string; country_code?: string } };
    if (d.address?.country_code && d.address.country_code !== "ng") return remember(key, OUTSIDE_NIGERIA);
    return remember(key, d.address?.state ?? null);
  } catch (err) {
    logger.warn("geo.reverse_failed", { error: err });
    return null; // not cached: try again next time
  }
}

/** "Lagos State" / "Federal Capital Territory" / "FCT (Abuja)" → comparable key. */
export function stateKey(name: string) {
  const n = name.toLowerCase().replace(/\bstate\b/g, "").replace(/[^a-z]/g, "");
  if (n.includes("federalcapital") || n.startsWith("fct") || n === "abuja") return "fct";
  if (n === "nassarawa") return "nasarawa";
  return n;
}

/**
 * Driving distance (km) from the nearest yard, using OpenRouteService's
 * heavy-goods-vehicle profile. Returns null when no key is set or the call
 * fails; the caller then falls back to a straight-line estimate.
 */
export async function routeFromNearestYard(yards: Yard[], lat: number, lng: number): Promise<{ yard: Yard; km: number } | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || !yards.length) return null;
  const key = `d:${yards.map((y) => `${y.lat},${y.lng}`).join("|")}>${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cached<{ yard: Yard; km: number } | null>(key);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-hgv", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [...yards.map((y) => [y.lng, y.lat]), [lng, lat]],
        sources: yards.map((_, i) => i),
        destinations: [yards.length],
        metrics: ["distance"],
        units: "km",
      }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ORS ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { distances?: (number | null)[][] };
    let best: { yard: Yard; km: number } | null = null;
    data.distances?.forEach((row, i) => {
      const km = row[0];
      if (typeof km === "number" && (!best || km < best.km)) best = { yard: yards[i]!, km };
    });
    return remember(key, best);
  } catch (err) {
    logger.warn("geo.route_failed", { error: err });
    return null;
  }
}
