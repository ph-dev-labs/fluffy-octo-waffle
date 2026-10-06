import type { Metadata } from "next";
import { getGallery } from "@/lib/catalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { QuoteSection } from "@/components/forms/QuoteSection";

export const metadata: Metadata = {
  title: "Gallery — containers and deliveries",
  description: "Real photos and videos of C-ZUCHI shipping containers at our Lagos and Port Harcourt terminals, and deliveries to customer sites.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const gallery = await getGallery();
  return (
    <>
      <PageHeader title="Gallery" body="Photos and short videos from our terminals, containers and deliveries." crumbs={[{ href: "/gallery", label: "Gallery" }]} />
      <section className="container-x py-16">
        <GalleryGrid items={gallery} />
      </section>
      <QuoteSection />
    </>
  );
}
