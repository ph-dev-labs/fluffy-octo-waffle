import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { distanceFeeKobo, feesBySize, inNigeria, nearestYardEstimate, type SizeMultipliers } from "@/lib/delivery/calc";
import { getDeliveryConfig } from "@/lib/delivery/service";
import { OUTSIDE_NIGERIA, reverseState, routeFromNearestYard } from "@/lib/delivery/geo";
import { signToken, verifyToken } from "@/lib/delivery/quote-token";

export interface HaulageConfig {
  enabled: boolean;
  baseFeeKobo: number;
  ratePerKmKobo: number;
  minFeeKobo: number;
  maxFeeKobo: number;
  maxDistanceKm: number;
  sizeMultipliers: SizeMultipliers;
  allowDeposit: boolean;
  depositPct: number;
}

/** Placeholders for the client to calibrate in /admin/haulage/settings. */
const DEFAULTS = {
  enabled: true,
  baseFeeKobo: 100_000_00,
  ratePerKmKobo: 800_00,
  minFeeKobo: 120_000_00,
  maxFeeKobo: 2_000_000_00,
  maxDistanceKm: 1800,
  sizeMultipliers: JSON.stringify({ "20FT": 100, "40FT": 140, "40HC": 140, "45HC": 160 }),
  allowDeposit: true,
  depositPct: 50,
};

export async function getHaulageConfig(): Promise<HaulageConfig> {
  // Created by the app (not a migration) so nothing changes until this code is live.
  const s = (await db.haulageSettings.findUnique({ where: { id: 1 } })) ?? (await db.haulageSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...DEFAULTS } }));
  let sizeMultipliers: SizeMultipliers = {};
  try {
    sizeMultipliers = JSON.parse(s.sizeMultipliers);
  } catch {
    /* fall back to 100% */
  }
  return { ...s, sizeMultipliers };
}

export const HAULAGE_SIZES = ["20FT", "40FT", "40HC", "45HC"] as const;
export type HaulageSize = (typeof HAULAGE_SIZES)[number];

export interface HaulageQuote {
  pickup: { lat: number; lng: number; state: string | null };
  dropoff: { lat: number; lng: number; state: string | null };
  size: HaulageSize;
  count: number;
  distanceKm: number;
  method: "DISTANCE" | "ESTIMATE";
  perContainerKobo: number;
  totalKobo: number;
  depositPct: number;
  allowDeposit: boolean;
}

export type HaulageQuoteOutcome = ({ ok: true } & HaulageQuote) | { ok: false; code: "QUOTE_REQUIRED" | "UNAVAILABLE" | "TOO_SHORT"; message: string };

const PURPOSE = "cz-haulage-quote-v1";
export const HAULAGE_QUOTE_TTL_MS = 45 * 60_000;

/** Prices moving `count` containers of `size` from the pickup pin to the drop-off pin. */
export async function quoteHaulage(input: { pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; size: HaulageSize; count: number }): Promise<HaulageQuoteOutcome> {
  const cfg = await getHaulageConfig();
  if (!cfg.enabled) return { ok: false, code: "UNAVAILABLE", message: "Online truck booking is paused right now. Please contact us and we'll arrange it." };

  const { pickup, dropoff } = input;
  if (!inNigeria(pickup.lat, pickup.lng) || !inNigeria(dropoff.lat, dropoff.lng)) {
    return { ok: false, code: "QUOTE_REQUIRED", message: "Both points must be in Nigeria. For cross-border moves, contact us for a quote." };
  }
  const [pickupState, dropoffState] = await Promise.all([reverseState(pickup.lat, pickup.lng), reverseState(dropoff.lat, dropoff.lng)]);
  if (pickupState === OUTSIDE_NIGERIA || dropoffState === OUTSIDE_NIGERIA) {
    return { ok: false, code: "QUOTE_REQUIRED", message: "Both points must be in Nigeria. For cross-border moves, contact us for a quote." };
  }

  // Road distance pickup → drop-off (reuses the yard router with the pickup as the only "yard").
  const from = [{ name: "Pickup", lat: pickup.lat, lng: pickup.lng }];
  const routed = await routeFromNearestYard(from, dropoff.lat, dropoff.lng);
  const roadFactorPct = (await getDeliveryConfig()).roadFactorPct;
  const found = routed ?? nearestYardEstimate(from, dropoff.lat, dropoff.lng, roadFactorPct)!;
  const km = Math.round(found.km * 10) / 10;
  if (km < 0.5) return { ok: false, code: "TOO_SHORT", message: "The pickup and drop-off pins are at the same spot — move one of them." };
  if (km > cfg.maxDistanceKm) {
    return { ok: false, code: "QUOTE_REQUIRED", message: `That's about ${Math.round(km)} km — further than we price online. Contact us for a quote.` };
  }

  const per = feesBySize(distanceFeeKobo(km, cfg), cfg.sizeMultipliers)[input.size]!;
  return {
    ok: true,
    pickup: { ...pickup, state: pickupState },
    dropoff: { ...dropoff, state: dropoffState },
    size: input.size,
    count: input.count,
    distanceKm: km,
    method: routed ? "DISTANCE" : "ESTIMATE",
    perContainerKobo: per,
    totalKobo: per * input.count,
    depositPct: cfg.depositPct,
    allowDeposit: cfg.allowDeposit,
  };
}

export function signHaulageQuote(q: HaulageQuote) {
  return signToken(PURPOSE, q, HAULAGE_QUOTE_TTL_MS);
}

export function verifyHaulageQuote(token: string) {
  const r = verifyToken<HaulageQuote>(PURPOSE, token);
  if (!r.ok) logger.info("haulage.quote_rejected", { reason: r.reason });
  return r;
}
