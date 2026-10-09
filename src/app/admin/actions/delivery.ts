"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { CONTAINER_SIZES, inNigeria } from "@/lib/delivery/calc";
import { stateKey } from "@/lib/delivery/geo";
import type { ActionState } from "./types";

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
const checkbox = z.literal("on").optional().transform((v) => v === "on");
const naira = (label: string) => z.coerce.number(`Enter ${label}`).min(0, "Can't be negative").max(100_000_000, "Too large");
/** Blank = no price (inherit / use distance). */
const optionalNaira = z
  .string()
  .trim()
  .transform((v) => v.replace(/[₦,\s]/g, ""))
  .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100_000_000), "Enter a price in naira, e.g. 150000")
  .transform((v) => (v === "" ? null : Math.round(Number(v) * 100)));

function refresh() {
  revalidatePath("/admin/delivery");
  revalidatePath("/checkout");
  revalidateTag("delivery-pricing"); // city landing-page estimates
}

const fmt = (kobo: number | null) => (kobo == null ? "inherit" : `₦${(kobo / 100).toLocaleString("en-NG")}`);

// ── Distance-pricing settings ────────────────────────────────────────────

const settingsSchema = z
  .object({
    distanceEnabled: checkbox,
    baseFee: naira("a base fee"),
    ratePerKm: naira("a rate per km"),
    minFee: naira("a minimum"),
    maxFee: naira("a maximum"),
    maxDistanceKm: z.coerce.number("Enter a distance").int().min(1).max(5000),
    roadFactorPct: z.coerce.number().int().min(100, "At least 100%").max(250, "At most 250%"),
    ...Object.fromEntries(CONTAINER_SIZES.map((s) => [`m_${s}`, z.coerce.number("Enter a %").int().min(10).max(1000)])),
  })
  .refine((v) => v.minFee <= v.maxFee, { path: ["maxFee"], message: "Must be at least the minimum" });

const yardSchema = z.object({
  name: z.string().trim().min(2, "Name the yard").max(60),
  lat: z.coerce.number("Pick on the map"),
  lng: z.coerce.number("Pick on the map"),
});

export async function saveDeliverySettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };

  const count = Math.min(Number(fd.get("yardCount") ?? 0) || 0, 10);
  const fields: Record<string, string> = {};
  const yards = [];
  for (let i = 0; i < count; i++) {
    const y = yardSchema.safeParse({ name: fd.get(`yard_name_${i}`), lat: fd.get(`yard_lat_${i}`), lng: fd.get(`yard_lng_${i}`) });
    if (!y.success) {
      for (const issue of y.error.issues) fields[`yard_${i}`] ??= issue.message;
      continue;
    }
    if (!inNigeria(y.data.lat, y.data.lng)) {
      fields[`yard_${i}`] = "That point is outside Nigeria";
      continue;
    }
    yards.push({ name: y.data.name, lat: Math.round(y.data.lat * 1e6) / 1e6, lng: Math.round(y.data.lng * 1e6) / 1e6 });
  }
  if (Object.keys(fields).length) return { message: "Please fix the yard locations.", fields };
  const v = parsed.data as z.infer<typeof settingsSchema> & Record<string, number>;
  if (v.distanceEnabled && !yards.length) return { message: "Add at least one yard, or switch distance pricing off." };

  const data = {
    distanceEnabled: v.distanceEnabled,
    yards: JSON.stringify(yards),
    baseFeeKobo: Math.round(v.baseFee * 100),
    ratePerKmKobo: Math.round(v.ratePerKm * 100),
    minFeeKobo: Math.round(v.minFee * 100),
    maxFeeKobo: Math.round(v.maxFee * 100),
    maxDistanceKm: v.maxDistanceKm,
    roadFactorPct: v.roadFactorPct,
    sizeMultipliers: JSON.stringify(Object.fromEntries(CONTAINER_SIZES.map((s) => [s, v[`m_${s}`]]))),
  };
  await db.deliverySettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  await audit(
    admin.id,
    "delivery.settings",
    "distance",
    `on=${data.distanceEnabled} base=${fmt(data.baseFeeKobo)} perKm=${fmt(data.ratePerKmKobo)} min=${fmt(data.minFeeKobo)} max=${fmt(data.maxFeeKobo)} maxKm=${data.maxDistanceKm} yards=${yards.map((y) => y.name).join("/")}`,
  );
  refresh();
  return { ok: true, message: "Distance pricing saved." };
}

// ── States & areas ───────────────────────────────────────────────────────

const zoneEditSchema = z.object({
  label: z.string().trim().min(2, "Name is required").max(80).optional(),
  price: optionalNaira,
  active: checkbox,
});

export async function saveZoneAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = zoneEditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const before = await db.deliveryZone.findUnique({ where: { id } });
  if (!before || before.kind === "REGION") return { message: "That zone no longer exists — refresh the page." };
  const { label, price, active } = parsed.data;
  await db.deliveryZone.update({
    where: { id },
    // State names are fixed (they're matched against the map); areas can be renamed.
    data: { perContainerKobo: price, active, ...(before.kind === "AREA" && label ? { label } : {}) },
  });
  await audit(admin.id, "delivery.update", before.code, `${fmt(before.perContainerKobo)} → ${fmt(price)}, active=${active}`);
  refresh();
  return { ok: true, message: `${label ?? before.label} saved.` };
}

function areaCode(stateCode: string, label: string) {
  const slug = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40 - stateCode.length - 1);
  return `${stateCode}_${slug}`;
}

const addAreaSchema = z.object({ label: z.string().trim().min(2, "Name the area").max(80), price: optionalNaira });

export async function addAreaAction(stateId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = addAreaSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { message: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const state = await db.deliveryZone.findFirst({ where: { id: stateId, kind: "STATE" } });
  if (!state) return { message: "That state no longer exists — refresh the page." };
  const code = areaCode(state.code, parsed.data.label);
  try {
    await db.deliveryZone.create({ data: { code, label: parsed.data.label, kind: "AREA", parentId: state.id, perContainerKobo: parsed.data.price, sortOrder: 999 } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { fields: { label: `${state.label} already has an area with that name` } };
    throw err;
  }
  await audit(admin.id, "delivery.create", code, fmt(parsed.data.price));
  refresh();
  return { ok: true, message: `${parsed.data.label} added to ${state.label}.` };
}

export async function deleteAreaAction(id: string) {
  const admin = await requireAdmin();
  const z = await db.deliveryZone.findFirst({ where: { id, kind: "AREA" } });
  if (!z) return;
  await db.deliveryZone.delete({ where: { id } });
  await audit(admin.id, "delivery.delete", z.code);
  refresh();
}

// ── CSV import: "State,Area,Price" ───────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function importZonesCsvAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const file = fd.get("file");
  let text = String(fd.get("csv") ?? "");
  if (file instanceof File && file.size) {
    if (file.size > 200_000) return { message: "That file is too large (max 200 KB)." };
    text = await file.text();
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { message: "Paste some rows or choose a CSV file." };
  if (lines.length > 2000) return { message: "Up to 2,000 rows at a time, please." };

  const states = await db.deliveryZone.findMany({ where: { kind: "STATE" }, include: { children: { where: { kind: "AREA" } } } });
  const byKey = new Map(states.flatMap((s) => [[stateKey(s.label), s] as const, [s.code.toLowerCase(), s] as const]));

  const errors: string[] = [];
  const ops: ((trx: Prisma.TransactionClient) => Promise<unknown>)[] = [];
  const newAreas = new Set<string>();
  let updated = 0;
  let created = 0;

  lines.forEach((line, idx) => {
    const [stateName = "", areaName = "", priceRaw = ""] = parseCsvLine(line);
    if (idx === 0 && /^state$/i.test(stateName)) return; // header row
    const row = idx + 1;
    const state = byKey.get(stateKey(stateName)) ?? byKey.get(stateName.toLowerCase());
    if (!state) return void errors.push(`Row ${row}: unknown state "${stateName}"`);
    const price = optionalNaira.safeParse(priceRaw);
    if (!price.success) return void errors.push(`Row ${row}: price "${priceRaw}" isn't a number`);

    if (!areaName) {
      ops.push((trx) => trx.deliveryZone.update({ where: { id: state.id }, data: { perContainerKobo: price.data } }));
      updated++;
      return;
    }
    if (areaName.length < 2 || areaName.length > 80) return void errors.push(`Row ${row}: area name must be 2–80 characters`);
    const existing = state.children.find((a) => a.label.toLowerCase() === areaName.toLowerCase());
    if (existing) {
      ops.push((trx) => trx.deliveryZone.update({ where: { id: existing.id }, data: { perContainerKobo: price.data } }));
      updated++;
    } else {
      const code = areaCode(state.code, areaName);
      ops.push((trx) =>
        trx.deliveryZone.upsert({
          where: { code },
          update: { perContainerKobo: price.data },
          create: { code, label: areaName, kind: "AREA", parentId: state.id, perContainerKobo: price.data, sortOrder: 999 },
        }),
      );
      if (!newAreas.has(code)) created++;
      newAreas.add(code);
    }
  });

  if (errors.length) return { message: `Nothing was changed. Fix these and try again: ${errors.slice(0, 8).join("; ")}${errors.length > 8 ? ` (+${errors.length - 8} more)` : ""}` };
  await db.$transaction(
    async (trx) => {
      for (const op of ops) await op(trx);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
  await audit(admin.id, "delivery.import", "csv", `${updated} updated, ${created} created`);
  refresh();
  return { ok: true, message: `Imported: ${updated} price${updated === 1 ? "" : "s"} updated, ${created} new area${created === 1 ? "" : "s"}.` };
}
