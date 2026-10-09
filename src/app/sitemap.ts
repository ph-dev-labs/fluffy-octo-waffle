import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { guides } from "@/content/guides";
import { landingPages } from "@/content/landing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const containers = await db.container.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "daily"],
    ["/browse", 0.9, "daily"],
    ["/haulage", 0.8, "monthly"],
    ["/shipping-containers", 0.9, "daily"],
    ["/guides", 0.6, "monthly"],
    ["/how-it-works", 0.6, "monthly"],
    ["/inspection", 0.6, "monthly"],
    ["/gallery", 0.5, "weekly"],
    ["/contact", 0.5, "monthly"],
  ];
  return [
    ...pages.map(([p, priority, changeFrequency]) => ({ url: `${base}${p}`, lastModified: new Date(), priority, changeFrequency })),
    ...landingPages.map((p) => ({ url: `${base}/shipping-containers/${p.slug}`, lastModified: new Date(), priority: p.group === "city" ? 0.7 : 0.85, changeFrequency: "daily" as const })),
    ...guides.map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: new Date(g.updated), priority: 0.6, changeFrequency: "monthly" as const })),
    ...containers.map((c) => ({ url: `${base}/containers/${c.slug}`, lastModified: c.updatedAt, priority: 0.8, changeFrequency: "weekly" as const })),
  ];
}
