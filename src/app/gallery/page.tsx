import type { Metadata } from "next";
import { gallery } from "@/content/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { QuoteSection } from "@/components/forms/QuoteSection";

export const metadata: Metadata = { title: "Gallery", description: "Photos and short videos from our terminals, containers and deliveries." };

export default function GalleryPage() {
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
