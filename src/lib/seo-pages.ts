import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { toCard } from "./catalog";
import { logger } from "./logger";
import { quoteDelivery } from "./delivery/service";

export interface PriceStat {
  size: string;
  count: number;
  minKobo: number;
  maxKobo: number;
}

/** Live listings + price range for a landing page filter. */
export async function listingsFor(filter: { sizes?: string[]; conditions?: string[] }, take = 12) {
  const where: Prisma.ContainerWhereInput = {
    active: true,
    ...(filter.sizes ? { size: { in: filter.sizes } } : {}),
    ...(filter.conditions ? { condition: { in: filter.conditions } } : {}),
  };
  const [rows, agg] = await Promise.all([
    db.container.findMany({ where, orderBy: [{ stock: "desc" }, { featured: "desc" }, { priceKobo: "asc" }], take }),
    db.container.aggregate({ where: { ...where, stock: { gt: 0 } }, _min: { priceKobo: true }, _max: { priceKobo: true }, _count: true }),
  ]);
  return {
    items: rows.map(toCard),
    inStock: agg._count,
    minKobo: agg._min.priceKobo,
    maxKobo: agg._max.priceKobo,
  };
}

/** Live price range per size (in-stock listings only). */
export async function priceStats(sizes: string[]): Promise<PriceStat[]> {
  const rows = await db.container.groupBy({
    by: ["size"],
    where: { active: true, stock: { gt: 0 }, size: { in: sizes } },
    _min: { priceKobo: true },
    _max: { priceKobo: true },
    _count: true,
  });
  return sizes
    .map((size) => rows.find((r) => r.size === size))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ size: r.size, count: r._count, minKobo: r._min.priceKobo ?? 0, maxKobo: r._max.priceKobo ?? 0 }));
}

export interface CityDelivery {
  feeFromKobo: number;
  distanceKm: number | null;
  method: string;
  state: string;
}

// Cached 6 h so page views don't hit the free map services. Failures throw
// (and are therefore not cached); the wrapper below turns them into null.
const cachedEstimate = unstable_cache(
  async (lat: number, lng: number): Promise<CityDelivery | null> => {
    const q = await quoteDelivery({ lat, lng });
    if (!q.ok) return null;
    return { feeFromKobo: q.perSize["20FT"] ?? Math.min(...Object.values(q.perSize)), distanceKm: q.distanceKm, method: q.method, state: q.stateLabel };
  },
  ["city-delivery-estimate-v1"],
  { revalidate: 6 * 3600, tags: ["delivery-pricing"] },
);

/** Delivery estimate to a city centre, from the same engine checkout uses. */
export async function cityDeliveryEstimate(lat: number, lng: number): Promise<CityDelivery | null> {
  try {
    return await cachedEstimate(lat, lng);
  } catch (err) {
    logger.warn("seo.city_estimate_failed", { lat, lng, error: err });
    return null;
  }
}
