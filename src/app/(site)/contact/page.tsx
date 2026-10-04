import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { site } from "@/content/site";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";
import { Reveal, RevealItem } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Contact us", description: "Speak directly with the C-ZUCHI team." };

export default function ContactPage() {
  const channels = [
    { icon: Phone, label: "Call us", value: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: "Chat with sales", href: site.whatsapp },
    { icon: Mail, label: "Email", value: site.email, href: `mailto:${site.email}` },
    { icon: MapPin, label: "Head office", value: site.address },
    { icon: Clock, label: "Opening hours", value: site.hours },
  ];
  return (
    <>
      <PageHeader title="Let’s talk containers" body="Questions about a listing, delivery or a bulk order? Our team responds fast." crumbs={[{ href: "/contact", label: "Contact" }]} />
      <section className="container-x grid gap-8 py-20 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal stagger={0.07} className="space-y-3">
          {channels.map(({ icon: Icon, label, value, href }) => {
            const inner = (
              <>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"><Icon className="size-5" /></span>
                <span>
                  <span className="block text-xs text-ink-400">{label}</span>
                  <span className="block font-semibold">{value}</span>
                </span>
              </>
            );
            return (
              <RevealItem key={label}>
                {href ? (
                  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="group flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink-900/5 transition-all hover:-translate-y-0.5 hover:shadow-card">{inner}</a>
                ) : (
                  <div className="group flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink-900/5">{inner}</div>
                )}
              </RevealItem>
            );
          })}
        </Reveal>
        <Reveal delay={0.1} className="rounded-[2rem] bg-white p-6 shadow-card ring-1 ring-ink-900/5 sm:p-10">
          <h2 className="font-display mb-8 text-2xl font-bold">Send us a message</h2>
          <ContactForm />
        </Reveal>
      </section>
    </>
  );
}
