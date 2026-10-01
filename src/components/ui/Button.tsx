"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "light" | "outline-light";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,box-shadow,color] duration-300 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-[0_8px_24px_-8px_rgb(34_87_235/0.7)] hover:bg-brand-700 hover:shadow-[0_12px_28px_-8px_rgb(34_87_235/0.8)]",
  accent: "bg-accent-500 text-white shadow-[0_8px_24px_-8px_rgb(255_107_44/0.7)] hover:bg-accent-600",
  secondary: "bg-white text-ink-900 ring-1 ring-ink-200 hover:ring-ink-300 hover:bg-ink-50",
  ghost: "text-ink-700 hover:bg-ink-100",
  light: "bg-white text-ink-900 hover:bg-ink-100",
  "outline-light": "text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/10 hover:ring-white/70",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

function Inner({ loading, icon, children }: Pick<CommonProps, "loading" | "icon" | "children">) {
  return (
    <>
      {/* sheen sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100"
      />
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      <span className="relative">{children}</span>
      {!loading && icon ? <span className="relative transition-transform duration-300 group-hover/btn:translate-x-0.5">{icon}</span> : null}
    </>
  );
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ComponentProps<"button">>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <Inner loading={loading} icon={icon}>
        {children}
      </Inner>
    </button>
  );
});

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      <Inner icon={icon}>{children}</Inner>
    </Link>
  );
}
