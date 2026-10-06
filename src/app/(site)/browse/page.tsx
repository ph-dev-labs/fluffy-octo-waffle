import type { Metadata } from "next";
import { Suspense } from "react";
import { browse, type BrowseFilters as Filters } from "@/lib/catalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrowseFilters } from "@/components/product/BrowseFilters";
import { ProductGrid } from "@/components/product/ProductGrid";
import { QuoteSection } from "@/components/forms/QuoteSection";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type SP = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Boolean(one(sp.q) || one(sp.size) || one(sp.condition) || one(sp.sort));
  return {
    title: "Shipping containers for sale — 20ft & 40ft",
    description: "Browse verified new and used 20ft and 40ft shipping containers for sale in Lagos and Port Harcourt. Upfront prices, free inspection, nationwide delivery.",
    alternates: { canonical: "/browse" },
    // Search/filter variations shouldn't compete with the main listing page in Google.
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BrowsePage({ searchParams }: SP) {
  const sp = await searchParams;
  const sortRaw = one(sp.sort);
  const filters: Filters = {
    q: one(sp.q),
    size: one(sp.size),
    condition: one(sp.condition),
    sort: sortRaw === "price_asc" || sortRaw === "price_desc" ? sortRaw : "newest",
  };
  const items = await browse(filters);

  return (
    <>
      <PageHeader title="Browse containers" body="Verified containers across our terminals. Book a viewing, or order with delivery." crumbs={[{ href: "/browse", label: "Containers" }]} />
      <section className="container-x -mt-8 pb-8">
        <Suspense>
          <BrowseFilters total={items.length} />
        </Suspense>
        <div className="mt-10">
          <ProductGrid items={items} />
        </div>
      </section>
      <QuoteSection />
    </>
  );
}
