"use client";

import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Play, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCarouselState } from "@/components/ui/Carousel";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  type: "image" | "video";
  src: string;
  caption: string;
}

const FILTERS = ["All", "Photos", "Videos"] as const;

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [open, setOpen] = useState<number | null>(null);
  const visible = items.filter((i) => filter === "All" || (filter === "Photos" ? i.type === "image" : i.type === "video"));

  return (
    <>
      <div className="mb-10 flex justify-center">
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-card ring-1 ring-ink-900/5" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn("relative rounded-full px-5 py-2 text-sm font-medium", filter === f ? "text-white" : "text-ink-500 hover:text-ink-900")}>
              {filter === f ? <motion.span layoutId="gallery-tab" className="absolute inset-0 rounded-full bg-ink-900" /> : null}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      <motion.ul layout className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
        <AnimatePresence mode="popLayout">
          {visible.map((item, i) => (
            <motion.li
              key={item.src}
              layout
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08 }}
              className="break-inside-avoid"
            >
              <button onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden rounded-3xl bg-ink-200" aria-label={`Open: ${item.caption}`}>
                {item.type === "image" ? (
                  <Image src={item.src} alt={item.caption} width={800} height={i % 3 === 0 ? 1000 : 600} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="h-auto w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                ) : (
                  <div className="relative aspect-[4/5]">
                    <video src={item.src} muted playsInline loop autoPlay preload="metadata" className="absolute inset-0 size-full object-cover" />
                    <span className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/90 text-ink-900 transition-transform group-hover:scale-110">
                      <Play className="size-4 fill-current" />
                    </span>
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink-950/80 to-transparent p-5 text-left text-sm font-medium text-white transition-transform duration-500 group-hover:translate-y-0">
                  {item.caption}
                </span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <GalleryLightbox items={visible} index={open} onClose={() => setOpen(null)} />
    </>
  );
}

function GalleryLightbox({ items, index, onClose }: { items: GalleryItem[]; index: number | null; onClose: () => void }) {
  return <AnimatePresence>{index !== null ? <LightboxInner items={items} start={index} onClose={onClose} /> : null}</AnimatePresence>;
}

function LightboxInner({ items, start, onClose }: { items: GalleryItem[]; start: number; onClose: () => void }) {
  const [ref, api] = useEmblaCarousel({ loop: true, startIndex: start });
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
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onKey]);

  return (
    <motion.div role="dialog" aria-modal="true" aria-label="Gallery" className="fixed inset-0 z-[70] flex flex-col bg-ink-950/95 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between p-4 text-white">
        <p className="text-sm text-ink-300">{items[selected]?.caption}</p>
        <button onClick={onClose} autoFocus className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="embla flex-1" ref={ref}>
        <div className="embla__container h-full">
          {items.map((item, i) => (
            <div key={item.src} className="embla__slide relative grid h-full basis-full place-items-center p-4 sm:p-10">
              {item.type === "image" ? (
                <Image src={item.src} alt={item.caption} fill sizes="100vw" className="object-contain p-4 sm:p-10" />
              ) : (
                <video src={item.src} controls playsInline autoPlay={i === selected} className="max-h-full max-w-full rounded-2xl" />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 p-6 text-white">
        <button onClick={prev} className="grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Previous">
          <ArrowLeft className="size-5" />
        </button>
        <span className="w-16 text-center text-sm tabular-nums text-ink-300">
          {selected + 1} / {items.length}
        </span>
        <button onClick={next} className="grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Next">
          <ArrowRight className="size-5" />
        </button>
      </div>
    </motion.div>
  );
}
