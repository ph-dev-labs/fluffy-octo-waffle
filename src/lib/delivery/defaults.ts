import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// First-run data for delivery pricing. Inserted by the app (not the migration)
// so the previous deployment never sees a zone without a price.

const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const LAGOS_AREAS = [
  "Agege", "Ajah", "Alimosho / Ikotun", "Amuwo-Odofin / Festac", "Apapa", "Badagry", "Epe", "Gbagada", "Ibeju-Lekki", "Ikeja",
  "Ikorodu", "Ikoyi", "Isolo / Oshodi", "Ketu / Mile 12 / Ojota", "Lagos Island", "Lekki", "Maryland / Ogba", "Mushin", "Ojo",
  "Surulere", "Victoria Island", "Yaba",
];

const code = (label: string) => (label.startsWith("FCT") ? "FCT" : label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""));

/** Placeholders for the client to calibrate in /admin/delivery: Apapa yard, ₦150k + ₦700/km, ₦150k–₦1.5M per 20ft. */
export const DEFAULT_SETTINGS = {
  distanceEnabled: true,
  yards: JSON.stringify([{ name: "Apapa yard", lat: 6.4474, lng: 3.364 }]),
  baseFeeKobo: 150_000_00,
  ratePerKmKobo: 700_00,
  minFeeKobo: 150_000_00,
  maxFeeKobo: 1_500_000_00,
  maxDistanceKm: 1800,
  roadFactorPct: 135,
  sizeMultipliers: JSON.stringify({ "20FT": 100, "40FT": 100, "40HC": 100, "45HC": 100 }),
};

let done: Promise<void> | null = null;

/** Idempotent; the settings row marks it as done. Cheap after the first call per instance. */
export function ensureDeliveryDefaults(): Promise<void> {
  done ??= seed().catch((err) => {
    done = null; // retry on the next request
    throw err;
  });
  return done;
}

async function seed() {
  if (await db.deliverySettings.findUnique({ where: { id: 1 }, select: { id: true } })) return;

  await db.deliveryZone.createMany({
    data: STATES.map((label, i) => ({ code: code(label), label, kind: "STATE", perContainerKobo: null, sortOrder: i })),
    skipDuplicates: true, // keeps the existing LAGOS row and its price
  });
  const lagos = await db.deliveryZone.findUniqueOrThrow({ where: { code: "LAGOS" }, select: { id: true } });
  await db.deliveryZone.createMany({
    data: LAGOS_AREAS.map((label, i) => ({ code: `LAGOS_${code(label)}`, label, kind: "AREA", parentId: lagos.id, perContainerKobo: null, sortOrder: i })),
    skipDuplicates: true,
  });
  // Created last: its existence means everything above is in place.
  await db.deliverySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...DEFAULT_SETTINGS } });
  logger.info("delivery.defaults_seeded", { states: STATES.length, lagosAreas: LAGOS_AREAS.length });
}
