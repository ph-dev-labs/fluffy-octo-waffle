import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const containers = await db.container.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  const pages = ["", "/browse", "/gallery", "/how-it-works", "/contact", "/inspection"].map((p) => ({ url: `${base}${p}`, lastModified: new Date() }));
  return [...pages, ...containers.map((c) => ({ url: `${base}/containers/${c.slug}`, lastModified: c.updatedAt }))];
}
