import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LivePrices } from "@/components/seo/SeoBits";
import { landingPages } from "@/content/landing";
import { breadcrumbLd, JsonLd } from "@/lib/seo";
import { priceStats } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: { absolute: "Buy Shipping Containers in Nigeria — by Size, Condition & City | C-ZUCHI" },
  description: "Shop shipping containers for sale in Nigeria by size (20ft, 40ft, High Cube), condition (new or used) or city — Lagos, Abuja, Port Harcourt, Ibadan, Kano and more.",
  alternates: { canonical: "/shipping-containers" },
};

const GROUPS = [
  { key: "size", title: "By size" },
  { key: "condition", title: "By condition" },
  { key: "city", title: "By city — delivered" },
] as const;

export default async function ShippingContainersHub() {
  const stats = await priceStats(["20FT", "40FT", "40HC", "45HC"]);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shipping containers", path: "/shipping-containers" }])} />
      <PageHeader title="Shipping containers for sale in Nigeria" body="Verified new and used 20ft and 40ft containers with live prices, free inspection and delivery anywhere in Nigeria." crumbs={[{ href: "/shipping-containers", label: "Shipping containers" }]} />
      <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <h2 className="font-display mb-4 text-2xl font-bold tracking-tight">{g.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {landingPages.filter((p) => p.group === g.key).map((p) => (
                  <Link key={p.slug} href={`/shipping-containers/${p.slug}`} className="group flex items-center justify-between gap-3 rounded-2xl bg-white p-5 font-semibold ring-1 ring-ink-900/5 hover:shadow-card">
                    {p.h1}
                    <ArrowRight className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <aside className="lg:sticky lg:top-28 lg:h-fit"><LivePrices stats={stats} /></aside>
      </section>
    </>
  );
}
