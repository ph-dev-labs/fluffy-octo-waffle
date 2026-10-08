import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { HaulageForm } from "@/components/haulage/HaulageForm";
import { JsonLd, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Container truck hire — move your container anywhere in Nigeria",
  description: "Book a flatbed truck to move your shipping container from the port, a terminal or any site to your location. Instant price by distance, pay in full or a deposit online with Paystack.",
  alternates: { canonical: "/haulage" },
};

export default function HaulagePage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Truck hire", path: "/haulage" }])} />
      <PageHeader
        title="Move your container anywhere in Nigeria"
        body="Already have a container at the port, a terminal or a site? Drop two pins, get an instant price by road distance, and book a flatbed truck. Pay in full or start with a deposit."
        crumbs={[{ href: "/haulage", label: "Truck hire" }]}
      />
      <section className="container-x py-16">
        <HaulageForm />
      </section>
    </>
  );
}
