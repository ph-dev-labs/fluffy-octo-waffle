import Link from "next/link";
import { Mail, MapPin, Phone, Clock, ShieldCheck } from "lucide-react";
import { nav, site } from "@/content/site";
import { Logo } from "./Logo";

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  x: <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />,
  instagram: <path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Zm0 7.75a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1ZM17 6a1.1 1.1 0 1 0 0 2.2A1.1 1.1 0 0 0 17 6Zm4 1.9c-.07-1.5-.4-2.83-1.5-3.92S17.08 2.55 15.58 2.5C14.04 2.4 9.96 2.4 8.42 2.5 6.93 2.55 5.6 2.9 4.5 3.98S2.57 6.4 2.5 7.9c-.1 1.54-.1 5.62 0 7.16.07 1.5.4 2.83 1.5 3.92s2.42 1.43 3.92 1.5c1.54.09 5.62.09 7.16 0 1.5-.07 2.83-.4 3.92-1.5s1.43-2.42 1.5-3.92c.09-1.54.09-5.62 0-7.16Z" />,
  facebook: <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14A28.2 28.2 0 0 0 14.64 2C11.93 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5Z" />,
  tiktok: <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.67a5.69 5.69 0 0 0-6.4 5.63A5.7 5.7 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />,
};

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink-950 text-ink-300">
      <div className="corrugated absolute inset-0 opacity-50" aria-hidden />
      <div className="container-x relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-5">
          <Logo light />
          <p className="max-w-sm text-sm leading-relaxed text-ink-400">{site.description}</p>
          <div className="flex gap-2">
            {Object.entries(site.socials).map(([k, href]) => (
              <a key={k} href={href} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid size-10 place-items-center rounded-full bg-white/5 text-ink-300 transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:text-white">
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  {SOCIAL_ICONS[k]}
                </svg>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold tracking-wider text-white uppercase">Explore</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition-colors hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/inspection" className="transition-colors hover:text-white">
                Book an inspection
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold tracking-wider text-white uppercase">Legal</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link href="/terms" className="hover:text-white">Terms &amp; conditions</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
          </ul>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-ink-300">
            <ShieldCheck className="size-3.5 text-success-600" /> Payments secured by Paystack
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold tracking-wider text-white uppercase">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3"><Phone className="size-4 shrink-0 text-accent-500" /><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-white">{site.phone}</a></li>
            <li className="flex gap-3"><Mail className="size-4 shrink-0 text-accent-500" /><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></li>
            <li className="flex gap-3"><MapPin className="size-4 shrink-0 text-accent-500" />{site.address}</li>
            <li className="flex gap-3"><Clock className="size-4 shrink-0 text-accent-500" />{site.hours}</li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/5">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} C-ZUCHI Group. All rights reserved.</p>
          <p>Prices in Nigerian Naira (₦).</p>
        </div>
      </div>
    </footer>
  );
}
