import Link from "next/link";
import { ArrowRight, ChevronDown, Tag } from "lucide-react";
import { formatNaira } from "@/lib/money";
import { SIZE_LABELS } from "@/lib/catalog";
import type { PriceStat } from "@/lib/seo-pages";

export function LivePrices({ stats, title = "Live prices" }: { stats: PriceStat[]; title?: string }) {
  if (!stats.length) return null;
  return (
    <div className="rounded-3xl bg-ink-900 p-6 text-white">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-accent-500 uppercase"><Tag className="size-3.5" /> {title}</p>
      <ul className="mt-4 divide-y divide-white/10">
        {stats.map((s) => (
          <li key={s.size} className="flex items-baseline justify-between gap-3 py-3">
            <Link href={`/browse?size=${s.size}`} className="font-medium hover:text-accent-500">{SIZE_LABELS[s.size] ?? s.size}</Link>
            <span className="text-right">
              <span className="font-display font-bold tabular-nums">{s.minKobo === s.maxKobo ? formatNaira(s.minKobo) : `${formatNaira(s.minKobo)} – ${formatNaira(s.maxKobo)}`}</span>
              <span className="block text-xs text-ink-400">{s.count} in stock</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-400">From our current listings, updated automatically. Delivery is priced separately at checkout.</p>
    </div>
  );
}

export function Faqs({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3">
      {faqs.map((f) => (
        <details key={f.q} className="group rounded-2xl bg-white p-5 ring-1 ring-ink-900/5 open:shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 leading-relaxed text-ink-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function RelatedLinks({ links, title = "Related" }: { links: { href: string; label: string }[]; title?: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-ink-900/5">
      <p className="text-xs font-semibold tracking-wider text-ink-400 uppercase">{title}</p>
      <ul className="mt-3 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900">
              {l.label}
              <ArrowRight className="size-4 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
