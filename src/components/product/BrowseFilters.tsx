"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

const SIZES = [
  { v: "", l: "All sizes" },
  { v: "20FT", l: "20ft" },
  { v: "40FT", l: "40ft" },
  { v: "40HC", l: "40ft HC" },
];
const CONDITIONS = [
  { v: "", l: "Any condition" },
  { v: "NEW", l: "Brand new" },
  { v: "USED", l: "Used" },
  { v: "REFURBISHED", l: "Refurbished" },
];

/** URL-driven filters: shareable links, back-button friendly, server-rendered results. */
export function BrowseFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // debounce free-text search
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => set("q", q.trim().slice(0, 80)), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative z-30 rounded-3xl lg:sticky lg:top-24 bg-white/85 p-3 shadow-card ring-1 ring-ink-900/5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <label htmlFor="browse-q" className="sr-only">Search containers</label>
          <input id="browse-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="Search containers, terminals…" className="h-11 w-full rounded-full bg-ink-50 pr-10 pl-11 text-sm outline-none focus:ring-2 focus:ring-brand-500/30" />
          {q ? (
            <button onClick={() => setQ("")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-200" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Segmented options={SIZES} value={params.get("size") ?? ""} onChange={(v) => set("size", v)} id="size" />
        <Segmented options={CONDITIONS} value={params.get("condition") ?? ""} onChange={(v) => set("condition", v)} id="cond" />
        <select aria-label="Sort" value={params.get("sort") ?? "newest"} onChange={(e) => set("sort", e.target.value === "newest" ? "" : e.target.value)} className="h-11 rounded-full bg-ink-50 px-4 text-sm font-medium outline-none">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
        </select>
      </div>
      <p className="mt-2 px-2 text-xs text-ink-400" aria-live="polite">
        {pending ? "Updating…" : `${total} container${total === 1 ? "" : "s"} found`}
      </p>
    </div>
  );
}

function Segmented({ options, value, onChange, id }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full bg-ink-50 p-1" role="radiogroup">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v} role="radio" aria-checked={active} onClick={() => onChange(o.v)} className={cn("relative rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors", active ? "text-white" : "text-ink-500 hover:text-ink-900")}>
            {active ? <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-ink-900" transition={{ type: "spring", stiffness: 400, damping: 34 }} /> : null}
            <span className="relative">{o.l}</span>
          </button>
        );
      })}
    </div>
  );
}
