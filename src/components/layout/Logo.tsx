import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark with a stylised container glyph. Swap for the official SVG logo when available. */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="C-ZUCHI home">
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-lg bg-brand-600 shadow-[0_6px_18px_-6px_rgb(34_87_235/0.8)] transition-transform duration-500 group-hover:rotate-[-6deg]">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
          <path d="M6.5 8.5v7M10 8.5v7M13.5 8.5v7M17 8.5v7" strokeLinecap="round" />
        </svg>
        <span className="absolute inset-x-0 bottom-0 h-1 bg-accent-500" />
      </span>
      <span className={cn("font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-ink-900")}>
        C<span className="text-accent-500">-</span>ZUCHI
      </span>
    </Link>
  );
}
