import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, PackageCheck, Phone, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Faqs, LivePrices, RelatedLinks } from "@/components/seo/SeoBits";
import { ButtonLink } from "@/components/ui/Button";
import { guideBySlug } from "@/content/guides";
import { landingBySlug, landingPages } from "@/content/landing";
import { site } from "@/content/site";
import { formatNaira } from "@/lib/money";
import { breadcrumbLd, faqLd, JsonLd, siteUrl } from "@/lib/seo";
import { cityDeliveryEstimate, listingsFor, priceStats } from "@/lib/seo-pages";

type Props = { params: Promise<{ slug: string }> };

const monthYear = () => new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Rendered per request: live prices, and the CSP nonce set by middleware.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = landingBySlug((await params).slug);
  if (!p) return {};
  const title = p.title.replace("{month}", monthYear());
  return { title: { absolute: title }, description: p.description, alternates: { canonical: `/shipping-containers/${p.slug}` }, openGraph: { title, description: p.description, url: `/shipping-containers/${p.slug}` } };
}

export default async function LandingPage({ params }: Props) {
  const p = landingBySlug((await params).slug);
  if (!p) notFound();

  const [listing, stats, delivery] = await Promise.all([
    listingsFor(p.filter),
    priceStats(p.filter.sizes ?? ["20FT", "40FT", "40HC", "45HC"]),
    p.city ? cityDeliveryEstimate(p.city.lat, p.city.lng) : Promise.resolve(null),
  ]);
  const guideLinks = p.guides.map(guideBySlug).filter((g) => !!g).map((g) => ({ href: `/guides/${g!.slug}`, label: g!.h1 }));
  const siblings = landingPages.filter((x) => x.group === p.group && x.slug !== p.slug).slice(0, 6).map((x) => ({ href: `/shipping-containers/${x.slug}`, label: x.h1 }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shipping containers", path: "/shipping-containers" }, { name: p.h1, path: `/shipping-containers/${p.slug}` }]),
          faqLd(p.faqs),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: p.h1,
            itemListElement: listing.items.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: siteUrl(`/containers/${c.slug}`), name: c.title })),
          },
        ]}
      />
      <PageHeader title={p.h1} body={p.intro} crumbs={[{ href: "/shipping-containers", label: "Shipping containers" }, { href: `/shipping-containers/${p.slug}`, label: p.h1 }]} />

      <section className="container-x -mt-10 relative z-10">
        <div className="grid gap-4 rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-900/5 sm:grid-cols-3">
          <Stat icon={<PackageCheck className="size-5" />} label="In stock now" value={listing.inStock ? `${listing.inStock} container${listing.inStock === 1 ? "" : "s"}` : "Ask us — we source to order"} />
          <Stat icon={<CheckCircle2 className="size-5" />} label="Prices from" value={listing.minKobo ? formatNaira(listing.minKobo) : "Request a quote"} />
          {p.city ? (
            <Stat
              icon={<Truck className="size-5" />}
              label={`Delivery to ${p.city.name}`}
              value={delivery ? `from ${formatNaira(delivery.feeFromKobo)}${delivery.distanceKm ? ` · ~${Math.round(delivery.distanceKm)} km` : ""}` : "Priced to your pin at checkout"}
            />
          ) : (
            <Stat icon={<Truck className="size-5" />} label="Delivery" value="Nationwide, priced to your location" />
          )}
        </div>
      </section>

      <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_340px]">
        <div className="space-y-12">
          <ul className="grid gap-3 sm:grid-cols-3">
            {p.points.map((pt) => (
              <li key={pt} className="flex items-start gap-2 rounded-2xl bg-white p-4 text-sm font-medium ring-1 ring-ink-900/5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" /> {pt}</li>
            ))}
          </ul>

          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Available now</h2>
              <Link href="/browse" className="text-sm font-semibold text-brand-600 hover:underline">See all containers →</Link>
            </div>
            <ProductGrid items={listing.items} />
          </div>

          {p.city ? (
            <div className="flex items-start gap-4 rounded-3xl bg-ink-50 p-6">
              <MapPin className="mt-1 size-5 shrink-0 text-brand-600" />
              <div className="space-y-1 text-sm leading-relaxed text-ink-600">
                <p className="font-semibold text-ink-900">How delivery to {p.city.name} is priced</p>
                <p>
                  At checkout, drop a pin on your exact site. The fee comes from the road distance between our yard and your pin{delivery?.state ? ` in ${delivery.state}` : ""}, and is shown before you pay. The figure above is for a 20ft container to central {p.city.name}; your final price depends on your exact location and container size.
                </p>
                <p>Already own a container elsewhere? <Link href="/haulage" className="font-semibold text-brand-600 underline underline-offset-2">Book a truck to move it</Link>.</p>
              </div>
            </div>
          ) : null}

          <section className="space-y-5">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
            <Faqs faqs={p.faqs} />
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:h-fit">
          <LivePrices stats={stats} />
          <RelatedLinks links={guideLinks} title="Buyer guides" />
          {siblings.length ? <RelatedLinks links={siblings} title={p.group === "city" ? "Other cities" : "Also popular"} /> : null}
          <div className="rounded-3xl bg-brand-50 p-6">
            <p className="font-display text-lg font-bold">Talk to sales</p>
            <p className="mt-1 text-sm text-ink-600">Bulk orders, sourcing a size we don&apos;t have, or delivery questions.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`tel:${site.phone.replace(/\s/g, "")}`} size="sm" icon={<Phone className="size-4" />}>Call {site.phone}</ButtonLink>
              <ButtonLink href="/inspection" size="sm" variant="secondary">Free inspection</ButtonLink>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-xs font-medium text-ink-400">{label}</p>
        <p className="font-display font-bold">{value}</p>
      </div>
    </div>
  );
}
