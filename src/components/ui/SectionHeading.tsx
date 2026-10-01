import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  action,
  dark,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  action?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className={cn("eyebrow", dark && "text-brand-400")}>
            <span className="h-px w-6 bg-current" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("font-display mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl", dark ? "text-white" : "text-ink-900")}>
          {title}
        </h2>
        {body ? <p className={cn("mt-4 text-base leading-relaxed text-pretty sm:text-lg", dark ? "text-ink-300" : "text-ink-500")}>{body}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </Reveal>
  );
}
