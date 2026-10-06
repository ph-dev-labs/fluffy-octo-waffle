import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Terms & conditions", alternates: { canonical: "/terms" } };

// TODO(client): replace with the legally reviewed terms and conditions.
export default function Page() {
  return (
    <>
      <PageHeader title="Terms & conditions" />
      <section className="container-x max-w-3xl py-20 text-ink-600">
        <p>This page will contain C-ZUCHI&apos;s terms and conditions. Content to be supplied by the client&apos;s legal team.</p>
      </section>
    </>
  );
}
