import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getFeatured, getGallery, getTerminals, getTestimonials } from "@/lib/catalog";
import { Hero, TrustStrip } from "@/components/home/Hero";
import { CtaBand, GalleryTeaser, StatsBand, StepsTimeline, TerminalMarquee, Testimonials } from "@/components/home/Sections";
import { ProductCard } from "@/components/product/ProductCard";
import { Carousel } from "@/components/ui/Carousel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { QuoteSection } from "@/components/forms/QuoteSection";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [featured, terminals, shots, testimonials] = await Promise.all([getFeatured(8), getTerminals(), getGallery(5), getTestimonials()]);

  return (
    <>
      <Hero />
      <TrustStrip />
      <TerminalMarquee terminals={terminals} />

      <section className="container-x py-24">
        <SectionHeading
          eyebrow="Top listings"
          title="Verified containers, ready today"
          body="Hand-picked units across our terminals. Every listing is inspected, photographed and priced upfront."
          action={
            <ButtonLink href="/browse" variant="secondary" icon={<ArrowRight className="size-4" />}>
              View all
            </ButtonLink>
          }
        />
        <div className="mt-12">
          {featured.length ? (
            <Carousel ariaLabel="Featured containers" autoplayMs={5000}>
              {featured.map((c, i) => (
                <ProductCard key={c.id} item={c} priority={i < 3} />
              ))}
            </Carousel>
          ) : (
            <p className="text-ink-500">New stock is on the way — check back soon.</p>
          )}
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="container-x">
          <SectionHeading eyebrow="How it works" title="From browsing to delivery in four steps" align="center" className="mb-16" />
          <StepsTimeline />
        </div>
      </section>

      <StatsBand />

      <section className="container-x py-24">
        <SectionHeading
          eyebrow="Gallery"
          title="Real containers. Real deliveries."
          body="Photos and short videos from our terminals and customer sites."
          action={
            <ButtonLink href="/gallery" variant="secondary" icon={<ArrowRight className="size-4" />}>
              Open gallery
            </ButtonLink>
          }
        />
        <div className="mt-12">
          <GalleryTeaser shots={shots} />
        </div>
      </section>

      {testimonials.length ? (
        <section className="overflow-hidden bg-ink-100/60 py-24">
          <div className="container-x">
            <SectionHeading eyebrow="Testimonials" title="Trusted by builders, traders and logistics teams" align="center" className="mb-12" />
          </div>
          <Testimonials testimonials={testimonials} />
        </section>
      ) : null}

      <div className="pt-24">
        <CtaBand />
      </div>
      <QuoteSection />
    </>
  );
}
