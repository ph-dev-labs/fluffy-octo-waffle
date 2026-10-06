import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck, MapPin, Ruler, ShieldCheck, Tag, Truck } from "lucide-react";
import { CONDITION_LABELS, getBySlug, getRelated, SIZE_LABELS, TYPE_LABELS } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductCard } from "@/components/product/ProductCard";
import { Carousel } from "@/components/ui/Carousel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { QuoteSection } from "@/components/forms/QuoteSection";
import { breadcrumbLd, JsonLd, siteUrl } from "@/lib/seo";
import { site } from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getBySlug((await params).slug);
  if (!c) return { title: "Container not found", robots: { index: false } };
  const size = SIZE_LABELS[c.size] ?? c.size;
  const description = `${c.title} for sale at ${c.terminal} — ${formatNaira(c.priceKobo)}. ${c.summary} Free inspection and delivery across Nigeria.`.slice(0, 300);
  return {
    // Add the size only when the listing title doesn't already say it (avoids "20ft Standard (20ft Standard)").
    title: `${c.title.toLowerCase().includes(c.size.slice(0, 2)) ? c.title : `${c.title} (${size})`} — ${formatNaira(c.priceKobo)}`,
    description,
    alternates: { canonical: `/containers/${c.slug}` },
    openGraph: { type: "website", title: `${c.title} — ${formatNaira(c.priceKobo)}`, description, url: `/containers/${c.slug}`, images: c.images.slice(0, 1).map((url) => ({ url, alt: c.title })) },
    twitter: { card: "summary_large_image", title: c.title, description, images: c.images.slice(0, 1) },
  };
}

export default async function ContainerPage({ params }: Props) {
  const { slug } = await params;
  const c = await getBySlug(slug);
  if (!c) notFound();
  const related = await getRelated(c.id, c.size);

  const specs = [
    { icon: Ruler, label: "Size", value: SIZE_LABELS[c.size] ?? c.size },
    { icon: Tag, label: "Condition", value: CONDITION_LABELS[c.condition] ?? c.condition },
    { icon: ShieldCheck, label: "Type", value: TYPE_LABELS[c.type] ?? c.type },
    { icon: MapPin, label: "Terminal", value: c.terminal },
  ];

  const CONDITION_SCHEMA: Record<string, string> = {
    NEW: "https://schema.org/NewCondition",
    USED: "https://schema.org/UsedCondition",
    REFURBISHED: "https://schema.org/RefurbishedCondition",
  };
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: c.title,
    description: c.description,
    sku: c.slug,
    category: "Shipping containers",
    image: c.images,
    brand: { "@type": "Brand", name: site.name },
    additionalProperty: specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })),
    offers: {
      "@type": "Offer",
      url: siteUrl(`/containers/${c.slug}`),
      priceCurrency: "NGN",
      price: (c.priceKobo / 100).toFixed(2),
      itemCondition: CONDITION_SCHEMA[c.condition] ?? "https://schema.org/UsedCondition",
      availability: c.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": siteUrl("/#organization") },
      areaServed: "NG",
    },
  };

  return (
    <>
      <JsonLd data={[productLd, breadcrumbLd([{ name: "Home", path: "/" }, { name: "Containers", path: "/browse" }, { name: c.title, path: `/containers/${c.slug}` }])]} />
      <section className="container-x pt-32 pb-16">
        <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-ink-400">
          <Link href="/" className="hover:text-ink-900">Home</Link>/<Link href="/browse" className="hover:text-ink-900">Containers</Link>/<span className="text-ink-700">{c.title}</span>
        </nav>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <Reveal>
            <ProductGallery images={c.images} title={c.title} />
          </Reveal>
          <Reveal delay={0.1} className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow">{SIZE_LABELS[c.size] ?? c.size}</p>
            <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">{c.title}</h1>
            <p className="mt-4 text-lg text-ink-500">{c.summary}</p>
            <p className="font-display mt-6 text-4xl font-bold tabular-nums">{formatNaira(c.priceKobo)}</p>
            <p className="mt-1 text-xs text-ink-400">Price per unit · delivery calculated at checkout</p>

            <dl className="mt-8 grid grid-cols-2 gap-3">
              {specs.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-ink-900/5">
                  <dt className="flex items-center gap-2 text-xs text-ink-400">
                    <Icon className="size-3.5" /> {label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8">
              <AddToCart item={c} stock={c.stock} />
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-dashed border-ink-200 p-4 text-sm sm:grid-cols-2">
              <Link href={`/inspection?container=${c.slug}`} className="flex items-center gap-2 font-medium text-brand-600 hover:underline">
                <CalendarCheck className="size-4" /> Book a free inspection
              </Link>
              <span className="flex items-center gap-2 text-ink-500">
                <Truck className="size-4" /> Delivery to all 36 states
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-16 max-w-3xl">
          <h2 className="font-display text-2xl font-bold">About this container</h2>
          <p className="mt-4 leading-relaxed whitespace-pre-line text-ink-600">{c.description}</p>
        </Reveal>
      </section>

      {related.length ? (
        <section className="container-x py-16">
          <SectionHeading
            eyebrow="You may also like"
            title="Similar containers"
            action={
              <ButtonLink href="/browse" variant="secondary" icon={<ArrowRight className="size-4" />}>
                View all
              </ButtonLink>
            }
          />
          <div className="mt-10">
            <Carousel ariaLabel="Similar containers">
              {related.map((r) => (
                <ProductCard key={r.id} item={r} />
              ))}
            </Carousel>
          </div>
        </section>
      ) : null}
      <QuoteSection />
    </>
  );
}
