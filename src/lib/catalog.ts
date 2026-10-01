import "server-only";
import type { Container, Prisma } from "@prisma/client";
import { db } from "./db";
import { parseImages } from "./utils";

export const SIZE_LABELS: Record<string, string> = {
  "20FT": "20ft Standard",
  "40FT": "40ft Standard",
  "40HC": "40ft High Cube",
  "45HC": "45ft High Cube",
};

export const CONDITION_LABELS: Record<string, string> = {
  NEW: "Brand new (one-trip)",
  USED: "Used · wind & watertight",
  REFURBISHED: "Refurbished",
};

export const TYPE_LABELS: Record<string, string> = {
  DRY: "Dry van",
  REEFER: "Refrigerated",
  OPEN_TOP: "Open top",
  FLAT_RACK: "Flat rack",
};

export interface ContainerCardData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  size: string;
  condition: string;
  type: string;
  terminal: string;
  priceKobo: number;
  image: string | null;
  inStock: boolean;
}

export function toCard(c: Container): ContainerCardData {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    size: c.size,
    condition: c.condition,
    type: c.type,
    terminal: c.terminal,
    priceKobo: c.priceKobo,
    image: parseImages(c.images)[0] ?? null,
    inStock: c.stock > 0,
  };
}

export async function getFeatured(limit = 8) {
  const rows = await db.container.findMany({
    where: { active: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toCard);
}

export interface BrowseFilters {
  q?: string;
  size?: string;
  condition?: string;
  sort?: "newest" | "price_asc" | "price_desc";
}

export async function browse(filters: BrowseFilters) {
  const where: Prisma.ContainerWhereInput = { active: true };
  if (filters.size && SIZE_LABELS[filters.size]) where.size = filters.size;
  if (filters.condition && CONDITION_LABELS[filters.condition]) where.condition = filters.condition;
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    where.OR = [{ title: { contains: q } }, { summary: { contains: q } }, { terminal: { contains: q } }, { size: { contains: q.toUpperCase() } }];
  }
  const orderBy: Prisma.ContainerOrderByWithRelationInput =
    filters.sort === "price_asc" ? { priceKobo: "asc" } : filters.sort === "price_desc" ? { priceKobo: "desc" } : { createdAt: "desc" };
  const rows = await db.container.findMany({ where, orderBy, take: 60 });
  return rows.map(toCard);
}

export async function getBySlug(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const c = await db.container.findFirst({ where: { slug, active: true } });
  if (!c) return null;
  return { ...toCard(c), description: c.description, images: parseImages(c.images), stock: c.stock };
}

export async function getRelated(excludeId: string, size: string, limit = 6) {
  const rows = await db.container.findMany({
    where: { active: true, id: { not: excludeId } },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 20,
  });
  return rows
    .sort((a, b) => Number(b.size === size) - Number(a.size === size))
    .slice(0, limit)
    .map(toCard);
}

export async function getTerminals() {
  const rows = await db.container.findMany({ where: { active: true }, select: { terminal: true }, distinct: ["terminal"] });
  return rows.map((r) => r.terminal);
}
