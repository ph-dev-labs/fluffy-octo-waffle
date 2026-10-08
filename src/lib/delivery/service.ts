import "server-only";
import { db } from "@/lib/db";
import { distanceFeeKobo, feesBySize, inNigeria, nearestYardEstimate, type DeliveryMethod, type SizeMultipliers, type Yard } from "./calc";
import { ensureDeliveryDefaults } from "./defaults";
import { OUTSIDE_NIGERIA, reverseState, routeFromNearestYard, stateKey } from "./geo";

export interface DeliveryConfig {
  distanceEnabled: boolean;
  yards: Yard[];
  baseFeeKobo: number;
  ratePerKmKobo: number;
  minFeeKobo: number;
  maxFeeKobo: number;
  maxDistanceKm: number;
  roadFactorPct: number;
  sizeMultipliers: SizeMultipliers;
}

const FALLBACK: DeliveryConfig = {
  distanceEnabled: false,
  yards: [],
  baseFeeKobo: 0,
  ratePerKmKobo: 0,
  minFeeKobo: 0,
  maxFeeKobo: 0,
  maxDistanceKm: 0,
  roadFactorPct: 135,
  sizeMultipliers: {},
};

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export { ensureDeliveryDefaults };

export async function getDeliveryConfig(): Promise<DeliveryConfig> {
  await ensureDeliveryDefaults();
  const s = await db.deliverySettings.findUnique({ where: { id: 1 } });
  if (!s) return FALLBACK;
  const yards = parseJson<Yard[]>(s.yards, []).filter((y) => Number.isFinite(y.lat) && Number.isFinite(y.lng));
  return { ...s, yards, sizeMultipliers: parseJson<SizeMultipliers>(s.sizeMultipliers, {}) };
}

export interface StateOption {
  code: string;
  label: string;
  areas: { code: string; label: string }[];
}

/** Active states and their active areas, for the checkout dropdowns. */
export async function listDeliveryStates(): Promise<StateOption[]> {
  await ensureDeliveryDefaults();
  const states = await db.deliveryZone.findMany({
    where: { kind: "STATE", active: true },
    orderBy: { label: "asc" },
    select: { code: true, label: true, children: { where: { kind: "AREA", active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { code: true, label: true } } },
  });
  return states.map((s) => ({ code: s.code, label: s.label, areas: s.children }));
}

export type QuoteOutcome =
  | {
      ok: true;
      stateCode: string;
      stateLabel: string;
      areaCode: string | null;
      areaLabel: string | null;
      method: DeliveryMethod;
      distanceKm: number | null;
      yard: string | null;
      perSize: Record<string, number>;
    }
  | { ok: false; code: "QUOTE_REQUIRED"; message: string; stateCode?: string; stateLabel?: string }
  | { ok: false; code: "STATE_MISMATCH"; message: string; stateCode: string; stateLabel: string }
  | { ok: false; code: "NEED_STATE" | "INVALID_ZONE"; message: string };

/**
 * Works out the delivery fee per container for a pin:
 *   1. the admin's price for the chosen area,
 *   2. else the admin's price for the state,
 *   3. else base + km × rate from the nearest yard (road distance when
 *      OpenRouteService is configured, otherwise a straight-line estimate),
 *   4. else (too far / outside Nigeria / distance pricing off) → quote by hand.
 */
export async function quoteDelivery(input: { lat: number; lng: number; stateCode?: string | null; areaCode?: string | null }): Promise<QuoteOutcome> {
  const { lat, lng } = input;
  await ensureDeliveryDefaults();
  if (!inNigeria(lat, lng)) return { ok: false, code: "QUOTE_REQUIRED", message: "That pin is outside Nigeria. Contact us and we'll quote this delivery personally." };

  const [allStates, detectedName] = await Promise.all([
    db.deliveryZone.findMany({ where: { kind: "STATE" }, select: { id: true, code: true, label: true, perContainerKobo: true, active: true } }),
    reverseState(lat, lng),
  ]);
  if (detectedName === OUTSIDE_NIGERIA) return { ok: false, code: "QUOTE_REQUIRED", message: "That pin is outside Nigeria. Contact us and we'll quote this delivery personally." };
  const states = allStates.filter((s) => s.active);
  // An OSM name we can't match to any state is ignored rather than trusted.
  const detectedAny = detectedName ? allStates.find((s) => stateKey(s.label) === stateKey(detectedName)) : undefined;
  const detected = detectedAny?.active ? detectedAny : undefined;

  if (detectedAny && !detectedAny.active) {
    // The pin is in a state the admin has switched off.
    return { ok: false, code: "QUOTE_REQUIRED", message: `We don't deliver to ${detectedAny.label} online yet. Contact us and we'll quote it personally.` };
  }

  const state = input.stateCode ? states.find((s) => s.code === input.stateCode) : detected;
  if (input.stateCode && !state) return { ok: false, code: "INVALID_ZONE", message: "We don't deliver to that state online yet. Contact us for a quote." };
  if (!state) return { ok: false, code: "NEED_STATE", message: "Choose your state so we can price this delivery." };
  if (detected && detected.code !== state.code) {
    return { ok: false, code: "STATE_MISMATCH", message: `Your pin is in ${detected.label}, but you chose ${state.label}.`, stateCode: detected.code, stateLabel: detected.label };
  }

  let area: { code: string; label: string; perContainerKobo: number | null } | null = null;
  if (input.areaCode) {
    area = await db.deliveryZone.findFirst({ where: { code: input.areaCode, kind: "AREA", active: true, parentId: state.id }, select: { code: true, label: true, perContainerKobo: true } });
    if (!area) return { ok: false, code: "INVALID_ZONE", message: "That area isn't available any more — choose another or 'Other area'." };
  }

  const cfg = await getDeliveryConfig();
  const base = { stateCode: state.code, stateLabel: state.label, areaCode: area?.code ?? null, areaLabel: area?.label ?? null };

  if (area?.perContainerKobo != null) return { ok: true, ...base, method: "AREA", distanceKm: null, yard: null, perSize: feesBySize(area.perContainerKobo, cfg.sizeMultipliers) };
  if (state.perContainerKobo != null) return { ok: true, ...base, method: "STATE", distanceKm: null, yard: null, perSize: feesBySize(state.perContainerKobo, cfg.sizeMultipliers) };

  const quoteRequired = { ok: false as const, code: "QUOTE_REQUIRED" as const, stateCode: state.code, stateLabel: state.label };
  if (!cfg.distanceEnabled || !cfg.yards.length) return { ...quoteRequired, message: `We price deliveries to ${state.label} individually. Contact us for a quote, or choose pickup.` };

  const routed = await routeFromNearestYard(cfg.yards, lat, lng);
  const found = routed ?? nearestYardEstimate(cfg.yards, lat, lng, cfg.roadFactorPct);
  if (!found) return { ...quoteRequired, message: "We couldn't work out a route to that pin. Contact us for a quote." };
  const km = Math.round(found.km * 10) / 10;
  if (km > cfg.maxDistanceKm) return { ...quoteRequired, message: `That's about ${Math.round(km)} km from our nearest yard — further than we price online. Contact us for a quote.` };

  return { ok: true, ...base, method: routed ? "DISTANCE" : "ESTIMATE", distanceKm: km, yard: found.yard.name, perSize: feesBySize(distanceFeeKobo(km, cfg), cfg.sizeMultipliers) };
}
