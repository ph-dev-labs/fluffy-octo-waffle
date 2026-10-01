import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { WordsReveal } from "@/components/ui/Reveal";

export function PageHeader({ title, body, crumbs = [] }: { title: string; body?: string; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="relative overflow-hidden bg-ink-950 pt-36 pb-20 text-white">
      <div className="corrugated absolute inset-0" aria-hidden />
      <div className="absolute -top-32 -right-24 size-[420px] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 left-10 size-[320px] rounded-full bg-accent-500/15 blur-3xl" aria-hidden />
      <div className="container-x relative">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-ink-400">
          <Link href="/" className="hover:text-white">Home</Link>
          {crumbs.map((c) => (
            <span key={c.href} className="flex items-center gap-1.5">
              <ChevronRight className="size-3" />
              <Link href={c.href} className="hover:text-white">{c.label}</Link>
            </span>
          ))}
        </nav>
        <h1 className="font-display max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          <WordsReveal text={title} />
        </h1>
        {body ? <p className="mt-5 max-w-2xl text-lg text-ink-300">{body}</p> : null}
      </div>
    </header>
  );
}
