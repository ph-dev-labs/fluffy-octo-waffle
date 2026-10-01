import type { Metadata } from "next";
import { ShieldCheck, Clock, IdCard } from "lucide-react";
import { getTerminals } from "@/lib/catalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { InspectionForm } from "@/components/forms/InspectionForm";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Book an inspection", description: "See a container in person at our terminals before you buy." };

export default async function InspectionPage({ searchParams }: { searchParams: Promise<{ container?: string }> }) {
  const [{ container }, terminals] = await Promise.all([searchParams, getTerminals()]);
  const slug = container && /^[a-z0-9-]{1,120}$/.test(container) ? container : undefined;
  return (
    <>
      <PageHeader title="Book an inspection" body="See it in person, then decide. Free, no obligation, at any of our terminals." crumbs={[{ href: "/inspection", label: "Inspection" }]} />
      <section className="container-x grid gap-8 py-20 lg:grid-cols-[1.2fr_0.8fr]">
        <Reveal className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-ink-900/5 sm:p-10">
          <InspectionForm terminals={terminals} containerSlug={slug} />
        </Reveal>
        <Reveal delay={0.1} className="space-y-4">
          {[
            { icon: Clock, t: "30-minute viewing", d: "A team member walks you through structure, doors, seals and floor." },
            { icon: IdCard, t: "Bring a valid ID", d: "Required for terminal access." },
            { icon: ShieldCheck, t: "No obligation", d: "Inspections are free. Buy only if you're happy." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink-900/5">
              <Icon className="size-5 shrink-0 text-accent-500" />
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-ink-500">{d}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>
    </>
  );
}
