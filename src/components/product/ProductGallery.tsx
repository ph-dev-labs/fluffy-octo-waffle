"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCarouselState } from "@/components/ui/Carousel";
import { cn } from "@/lib/utils";

/** Main image carousel synced with a thumbnail strip, plus a fullscreen lightbox. */
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [mainRef, mainApi] = useEmblaCarousel({ loop: images.length > 1 });
  const [thumbRef, thumbApi] = useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true });
  const { selected, prev, next, scrollTo } = useCarouselState(mainApi);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    thumbApi?.scrollTo(selected);
  }, [selected, thumbApi]);

  if (!images.length) return <div className="aspect-[4/3] rounded-3xl bg-ink-100" />;

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-[2rem] bg-ink-100">
        <div className="embla" ref={mainRef}>
          <div className="embla__container">
            {images.map((src, i) => (
              <div key={src} className="embla__slide relative aspect-[4/3] basis-full">
                <Image src={src} alt={`${title} — photo ${i + 1}`} fill priority={i === 0} sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 ? (
          <>
            <GalleryArrow side="left" onClick={prev} />
            <GalleryArrow side="right" onClick={next} />
          </>
        ) : null}
        <button onClick={() => setLightbox(true)} className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-ink-900 backdrop-blur transition-transform hover:scale-105" aria-label="View fullscreen">
          <Expand className="size-3.5" /> {selected + 1} / {images.length}
        </button>
      </div>

      {images.length > 1 ? (
        <div className="embla" ref={thumbRef}>
          <div className="embla__container gap-3">
            {images.map((src, i) => (
              <button
                key={src}
                onClick={() => scrollTo(i)}
                className={cn("embla__slide relative aspect-[4/3] basis-24 overflow-hidden rounded-2xl transition-all duration-300 sm:basis-28", selected === i ? "ring-2 ring-brand-600 ring-offset-2" : "opacity-60 hover:opacity-100")}
                aria-label={`Show photo ${i + 1}`}
                aria-current={selected === i}
              >
                <Image src={src} alt="" fill sizes="112px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Lightbox open={lightbox} onClose={() => setLightbox(false)} images={images} start={selected} title={title} />
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ArrowLeft : ArrowRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-900 opacity-0 shadow-card backdrop-blur transition-all duration-300 group-hover:opacity-100 hover:bg-white focus-visible:opacity-100",
        side === "left" ? "left-4 group-hover:left-5" : "right-4 group-hover:right-5",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function Lightbox({ open, onClose, images, start, title }: { open: boolean; onClose: () => void; images: string[]; start: number; title: string }) {
  const [ref, api] = useEmblaCarousel({ loop: images.length > 1, startIndex: start });
  const { selected, prev, next } = useCarouselState(api);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    },
    [onClose, prev, next],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onKey]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div role="dialog" aria-modal="true" aria-label={`${title} photos`} className="fixed inset-0 z-[70] flex flex-col bg-ink-950/95 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center justify-between p-4 text-white">
            <p className="text-sm tabular-nums text-ink-300">
              {selected + 1} / {images.length}
            </p>
            <button onClick={onClose} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close" autoFocus>
              <X className="size-5" />
            </button>
          </div>
          <motion.div className="embla flex-1" ref={ref} initial={{ scale: 0.94 }} animate={{ scale: 1 }}>
            <div className="embla__container h-full">
              {images.map((src, i) => (
                <div key={src} className="embla__slide relative h-full basis-full">
                  <Image src={src} alt={`${title} — photo ${i + 1}`} fill sizes="100vw" className="object-contain p-4 sm:p-10" />
                </div>
              ))}
            </div>
          </motion.div>
          {images.length > 1 ? (
            <div className="flex justify-center gap-3 p-6">
              <button onClick={prev} className="grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Previous">
                <ArrowLeft className="size-5" />
              </button>
              <button onClick={next} className="grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Next">
                <ArrowRight className="size-5" />
              </button>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
