import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

// TODO(client): replace with the legally reviewed privacy policy.
export default function Page() {
  return (
    <>
      <PageHeader title="Privacy policy" />
      <section className="container-x max-w-3xl py-20 text-ink-600">
        <p>This page will contain C-ZUCHI&apos;s privacy policy. Content to be supplied by the client&apos;s legal team.</p>
      </section>
    </>
  );
}
