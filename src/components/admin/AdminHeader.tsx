import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function AdminHeader({ title, description, back, actions }: { title: string; description?: string; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <ChevronLeft className="size-4" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
