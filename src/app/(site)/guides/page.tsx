import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { guides } from "@/content/guides";
import { breadcrumbLd, JsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Shipping Container Buying Guides",
  description: "Practical guides to buying shipping containers in Nigeria: sizes and dimensions, 20ft vs 40ft, new vs used, inspection checklist and popular uses.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <PageHeader title="Container buying guides" body="Straight answers to the questions buyers ask us most — before you spend a naira." crumbs={[{ href: "/guides", label: "Guides" }]} />
      <section className="container-x grid gap-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="group flex flex-col rounded-3xl bg-white p-7 ring-1 ring-ink-900/5 transition-shadow hover:shadow-card">
            <p className="flex items-center gap-1.5 text-xs text-ink-400"><Clock className="size-3.5" /> {g.readMins} min read</p>
            <h2 className="font-display mt-3 text-xl font-bold tracking-tight">{g.h1}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500">{g.description}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">Read guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        ))}
      </section>
    </>
  );
}
