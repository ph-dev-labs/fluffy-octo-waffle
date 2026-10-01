import { Clock, FileText, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { QuoteForm } from "./QuoteForm";

export function QuoteSection() {
  return (
    <section id="quote" className="container-x scroll-mt-28 py-24">
      <div className="grid overflow-hidden rounded-[2.5rem] bg-white shadow-card ring-1 ring-ink-900/5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-ink-900 p-8 text-white sm:p-12">
          <div className="corrugated absolute inset-0" aria-hidden />
          <div className="absolute -bottom-32 -left-32 size-80 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
          <Reveal className="relative">
            <p className="eyebrow text-accent-500">
              <span className="h-px w-6 bg-current" />
              Request a quote
            </p>
            <h2 className="font-display mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Bulk order or special requirement?</h2>
            <p className="mt-4 text-ink-300">Tell us what you need — sizes, quantity, delivery location — and we&apos;ll send a tailored price.</p>
            <ul className="mt-10 space-y-5">
              {[
                { icon: Clock, t: "Response within 1 business day" },
                { icon: FileText, t: "Itemised quote incl. delivery" },
                { icon: MessageCircle, t: "Dedicated account manager" },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10">
                    <Icon className="size-4 text-accent-500" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <div className="p-6 sm:p-12">
          <QuoteForm />
        </div>
      </div>
    </section>
  );
}
