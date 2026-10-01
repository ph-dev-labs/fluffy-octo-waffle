"use client";

import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaOptionsType, EmblaCarouselType } from "embla-carousel";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Children, useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CarouselProps {
  children: ReactNode;
  options?: EmblaOptionsType;
  autoplayMs?: number;
  /** Tailwind width classes for each slide, e.g. "basis-[85%] sm:basis-1/2 lg:basis-1/3" */
  slideClassName?: string;
  className?: string;
  ariaLabel: string;
  controls?: "top" | "bottom" | "none";
  dark?: boolean;
}

/** Reusable Embla carousel: arrows, scroll-progress bar, keyboard + a11y. */
export function Carousel({
  children,
  options,
  autoplayMs,
  slideClassName = "basis-[85%] sm:basis-1/2 lg:basis-1/3",
  className,
  ariaLabel,
  controls = "bottom",
  dark,
}: CarouselProps) {
  const [ref, api] = useEmblaCarousel(
    { align: "start", containScroll: "trimSnaps", skipSnaps: false, ...options },
    autoplayMs ? [Autoplay({ delay: autoplayMs, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );
  const { canPrev, canNext, progress, prev, next } = useCarouselState(api);
  const slides = Children.toArray(children);

  const Controls = (
    <div className="flex items-center gap-4">
      <div className={cn("relative h-1 w-24 overflow-hidden rounded-full sm:w-40", dark ? "bg-white/15" : "bg-ink-200")} aria-hidden>
        <motion.div className={cn("absolute inset-y-0 left-0 rounded-full", dark ? "bg-white" : "bg-ink-900")} animate={{ width: `${Math.max(12, progress * 100)}%` }} transition={{ type: "spring", stiffness: 260, damping: 30 }} />
      </div>
      <div className="flex gap-2">
        <ArrowButton dir="prev" onClick={prev} disabled={!canPrev} dark={dark} />
        <ArrowButton dir="next" onClick={next} disabled={!canNext} dark={dark} />
      </div>
    </div>
  );

  return (
    <section
      className={cn("relative", className)}
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
    >
      {controls === "top" ? <div className="mb-6 flex justify-end">{Controls}</div> : null}
      <div className="embla -mx-2 py-2" ref={ref}>
        <div className="embla__container">
          {slides.map((child, i) => (
            <div key={i} className={cn("embla__slide px-2", slideClassName)} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
              {child}
            </div>
          ))}
        </div>
      </div>
      {controls === "bottom" ? <div className="mt-8 flex justify-end">{Controls}</div> : null}
    </section>
  );
}

function ArrowButton({ dir, onClick, disabled, dark }: { dir: "prev" | "next"; onClick: () => void; disabled: boolean; dark?: boolean }) {
  const Icon = dir === "prev" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
      className={cn(
        "grid size-11 place-items-center rounded-full transition-all duration-300 disabled:opacity-30",
        dark ? "bg-white/10 text-white hover:bg-white hover:text-ink-900" : "bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-900 hover:text-white hover:ring-ink-900",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function useCarouselState(api: EmblaCarouselType | undefined) {
  const [state, setState] = useState({ canPrev: false, canNext: false, selected: 0, snaps: 0, progress: 0 });

  const sync = useCallback((a: EmblaCarouselType) => {
    setState({
      canPrev: a.canScrollPrev(),
      canNext: a.canScrollNext(),
      selected: a.selectedScrollSnap(),
      snaps: a.scrollSnapList().length,
      progress: Math.max(0, Math.min(1, a.scrollProgress())),
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    sync(api);
    api.on("select", sync).on("reInit", sync).on("scroll", sync);
    return () => {
      api.off("select", sync).off("reInit", sync).off("scroll", sync);
    };
  }, [api, sync]);

  return {
    ...state,
    prev: () => api?.scrollPrev(),
    next: () => api?.scrollNext(),
    scrollTo: (i: number) => api?.scrollTo(i),
  };
}
