import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { guides } from "@/content/guides";
import { landingPages } from "@/content/landing";

export const dynamic = "force-dynamic";

// lastModified must reflect real changes — Google ignores it site-wide once it
// learns every URL claims "now". Listing pages change when stock does; static
// pages omit it.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const containers = await db.container.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  const stockChanged = containers.reduce<Date | undefined>((max, c) => (!max || c.updatedAt > max ? c.updatedAt : max), undefined);
  const guidesChanged = guides.reduce<Date | undefined>((max, g) => {
    const d = new Date(g.updated);
    return !max || d > max ? d : max;
  }, undefined);

  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"], Date | undefined][] = [
    ["", 1, "daily", stockChanged],
    ["/browse", 0.9, "daily", stockChanged],
    ["/haulage", 0.8, "monthly", undefined],
    ["/shipping-containers", 0.9, "daily", stockChanged],
    ["/guides", 0.6, "monthly", guidesChanged],
    ["/how-it-works", 0.6, "monthly", undefined],
    ["/inspection", 0.6, "monthly", undefined],
    ["/gallery", 0.5, "weekly", undefined],
    ["/contact", 0.5, "monthly", undefined],
  ];
  return [
    ...pages.map(([p, priority, changeFrequency, lastModified]) => ({ url: `${base}${p}`, lastModified, priority, changeFrequency })),
    ...landingPages.map((p) => ({ url: `${base}/shipping-containers/${p.slug}`, lastModified: stockChanged, priority: p.group === "city" ? 0.7 : 0.85, changeFrequency: "daily" as const })),
    ...guides.map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: new Date(g.updated), priority: 0.6, changeFrequency: "monthly" as const })),
    ...containers.map((c) => ({ url: `${base}/containers/${c.slug}`, lastModified: c.updatedAt, priority: 0.8, changeFrequency: "weekly" as const })),
  ];
}
