// Pure delivery-pricing maths (no I/O) so it can be unit-tested and shared.
// All money is integer kobo. Fees are "per 20ft container"; bigger sizes are
// scaled by the admin's size multipliers (percent).

export type DeliveryMethod = "AREA" | "STATE" | "DISTANCE" | "ESTIMATE";

export interface Yard {
  name: string;
  lat: number;
  lng: number;
}

export interface DistanceRules {
  baseFeeKobo: number;
  ratePerKmKobo: number;
  minFeeKobo: number;
  maxFeeKobo: number;
}

export const CONTAINER_SIZES = ["20FT", "40FT", "40HC", "45HC"] as const;
export type SizeMultipliers = Record<string, number>;

/** Mainland Nigeria plus a small margin. Pins outside it are never priced automatically. */
export const NIGERIA_BOUNDS = { minLat: 4.0, maxLat: 14.0, minLng: 2.6, maxLng: 14.8 };

export function inNigeria(lat: number, lng: number) {
  const b = NIGERIA_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nearest yard by straight-line distance, with a road-distance estimate. */
export function nearestYardEstimate(yards: Yard[], lat: number, lng: number, roadFactorPct: number) {
  let best: { yard: Yard; km: number } | null = null;
  for (const yard of yards) {
    const km = (haversineKm(yard.lat, yard.lng, lat, lng) * roadFactorPct) / 100;
    if (!best || km < best.km) best = { yard, km };
  }
  return best;
}

/** base + km × rate, clamped to [min, max], rounded to the nearest ₦1,000. */
export function distanceFeeKobo(km: number, rules: DistanceRules) {
  const raw = rules.baseFeeKobo + Math.round(km * rules.ratePerKmKobo);
  const clamped = Math.min(Math.max(raw, rules.minFeeKobo), rules.maxFeeKobo);
  return Math.round(clamped / 100_000) * 100_000;
}

export function multiplierFor(size: string, multipliers: SizeMultipliers) {
  const m = multipliers[size];
  return Number.isFinite(m) && m > 0 ? m : 100;
}

/** Fee for one container of each known size, from a per-20ft fee. */
export function feesBySize(base20ftKobo: number, multipliers: SizeMultipliers): Record<string, number> {
  return Object.fromEntries(CONTAINER_SIZES.map((s) => [s, Math.round((base20ftKobo * multiplierFor(s, multipliers)) / 100)]));
}

/** Total for a cart: Σ fee(size) × quantity. */
export function deliveryTotalKobo(perSize: Record<string, number>, units: { size: string; quantity: number }[], fallbackKobo: number) {
  return units.reduce((sum, u) => sum + (perSize[u.size] ?? fallbackKobo) * u.quantity, 0);
}
