import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Blocks } from "@/components/seo/RichText";
import { Faqs, LivePrices, RelatedLinks } from "@/components/seo/SeoBits";
import { ButtonLink } from "@/components/ui/Button";
import { guideBySlug } from "@/content/guides";
import { site } from "@/content/site";
import { breadcrumbLd, faqLd, JsonLd, siteUrl } from "@/lib/seo";
import { priceStats } from "@/lib/seo-pages";

type Props = { params: Promise<{ slug: string }> };

// Rendered per request: live prices, and the CSP nonce set by middleware.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: { type: "article", title: g.title, description: g.description, url: `/guides/${g.slug}`, modifiedTime: g.updated },
  };
}

export default async function GuidePage({ params }: Props) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const stats = g.livePrices ? await priceStats(g.livePrices) : [];
  const updated = new Date(g.updated).toLocaleDateString("en-NG", { dateStyle: "long" });

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.h1,
            description: g.description,
            dateModified: g.updated,
            mainEntityOfPage: siteUrl(`/guides/${g.slug}`),
            author: { "@id": siteUrl("/#organization") },
            publisher: { "@id": siteUrl("/#organization") },
            image: siteUrl("/opengraph-image.png"),
          },
          faqLd(g.faqs),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: g.h1, path: `/guides/${g.slug}` }]),
        ]}
      />
      <PageHeader title={g.h1} body={g.description} crumbs={[{ href: "/guides", label: "Guides" }, { href: `/guides/${g.slug}`, label: g.h1 }]} />
      <section className="container-x grid gap-12 py-16 lg:grid-cols-[1fr_340px]">
        <article className="max-w-3xl space-y-12">
          <p className="flex items-center gap-2 text-sm text-ink-500"><Clock className="size-4" /> {g.readMins} min read · Updated {updated}</p>
          {g.sections.map((s) => (
            <section key={s.h2} className="space-y-5">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{s.h2}</h2>
              <Blocks blocks={s.body} />
            </section>
          ))}
          <section className="space-y-5">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
            <Faqs faqs={g.faqs} />
          </section>
        </article>
        <aside className="space-y-6 lg:sticky lg:top-28 lg:h-fit">
          <LivePrices stats={stats} title="Live container prices" />
          <RelatedLinks links={g.related} title="Next steps" />
          <div className="rounded-3xl bg-brand-50 p-6">
            <p className="font-display text-lg font-bold">Need help choosing?</p>
            <p className="mt-1 text-sm text-ink-600">Talk to our sales team — or book a free inspection.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={`tel:${site.phone.replace(/\s/g, "")}`} size="sm" icon={<Phone className="size-4" />}>Call us</ButtonLink>
              <ButtonLink href="/inspection" size="sm" variant="secondary">Book inspection</ButtonLink>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
