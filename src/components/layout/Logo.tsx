import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import logoMark from "../../../public/brand/logo-mark.png";
import logoMarkWhite from "../../../public/brand/logo-mark-white.png";

/** Brand mark (crown + chevrons) with the wordmark beside it. `light` = for dark backgrounds. */
export function Logo({ light, className, href = "/", subtitle = true }: { light?: boolean; className?: string; href?: string; subtitle?: boolean }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)} aria-label="C-ZUCHI Global Service Ltd — home">
      <LogoMark light={light} className="h-9 w-auto transition-transform duration-500 group-hover:-translate-y-0.5" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-[#192440]")}>C-ZUCHI</span>
        {subtitle ? (
          <span className={cn("mt-0.5 text-[9px] font-semibold tracking-[0.18em] uppercase", light ? "text-white/60" : "text-[#192440]/60")}>Global Service Ltd</span>
        ) : null}
      </span>
    </Link>
  );
}

export function LogoMark({ light, className }: { light?: boolean; className?: string }) {
  return <Image src={light ? logoMarkWhite : logoMark} alt="" priority className={className} sizes="64px" />;
}
