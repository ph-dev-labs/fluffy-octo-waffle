import type { Metadata } from "next";
import { Suspense } from "react";
import { browse, type BrowseFilters as Filters } from "@/lib/catalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrowseFilters } from "@/components/product/BrowseFilters";
import { ProductGrid } from "@/components/product/ProductGrid";
import { QuoteSection } from "@/components/forms/QuoteSection";

export const metadata: Metadata = {
  title: "Browse containers",
  description: "Browse verified 20ft and 40ft shipping containers across our terminals.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
