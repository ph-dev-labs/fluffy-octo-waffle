import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CreditCard, FileCheck2, Headset } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StepsTimeline } from "@/components/home/Sections";
import { Reveal, RevealItem } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { QuoteSection } from "@/components/forms/QuoteSection";

export const metadata: Metadata = { title: "How it works", description: "Browse, inspect or buy, choose delivery, and receive your container." };

const PROMISES = [
  { icon: BadgeCheck, t: "Inspected inventory", d: "Every container is checked for structure, doors, seals and floor before listing." },
  { icon: CreditCard, t: "Secure payments", d: "Pay by card, bank transfer or USSD through Paystack. We never see your card details." },
  { icon: FileCheck2, t: "Proper documentation", d: "Receipt and handover documents provided with every purchase." },
  { icon: Headset, t: "Real people", d: "Speak directly with our team on phone or WhatsApp — before and after you buy." },
];

// TODO(client): confirm delivery timelines and policies before launch.
const FAQ = [
  { q: "Can I inspect a container before paying?", a: "Yes. Book a free inspection at any of our terminals and our team will walk you through the unit." },
  { q: "What happens if my payment fails or my network drops?", a: "You are never charged twice. Every payment is confirmed directly with Paystack — if your connection drops, we confirm automatically and email your receipt. If a charge fails, you can safely retry." },
  { q: "How long does delivery take?", a: "Lagos deliveries typically take 1–3 business days after payment; other states 3–7 business days depending on location." },
  { q: "Do you offer bulk pricing?", a: "Yes — use the quote form for orders of several containers and our sales team will send a tailored price." },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader title="How it works" body="Buying a container should be simple. Here’s how we get one from our yard to your site." crumbs={[{ href: "/how-it-works", label: "How it works" }]} />
      <section className="container-x py-24">
        <StepsTimeline />
      </section>

      <section className="bg-white py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Our promise" title="Built on trust" align="center" />
          <Reveal stagger={0.08} className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map(({ icon: Icon, t, d }) => (
              <RevealItem key={t} className="group rounded-3xl bg-ink-50 p-7 transition-colors duration-500 hover:bg-ink-900">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-card transition-transform duration-500 group-hover:-rotate-6">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display mt-6 text-lg font-bold transition-colors group-hover:text-white">{t}</h3>
                <p className="mt-2 text-sm text-ink-500 transition-colors group-hover:text-ink-300">{d}</p>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="container-x py-24">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" align="center" />
        <Reveal stagger={0.06} className="mx-auto mt-12 max-w-3xl space-y-3">
          {FAQ.map((f) => (
            <RevealItem key={f.q}>
              <details className="group rounded-2xl bg-white p-6 ring-1 ring-ink-900/5 open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-100 transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-ink-500">{f.a}</p>
              </details>
            </RevealItem>
          ))}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <ButtonLink href="/browse" size="lg" icon={<ArrowRight className="size-4" />}>Browse containers</ButtonLink>
        </div>
      </section>
      <QuoteSection />
    </>
  );
}
