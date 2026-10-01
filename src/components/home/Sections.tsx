"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, Quote, Search, ClipboardCheck, Truck, PackageCheck, Play } from "lucide-react";
import { useRef } from "react";
import { gallery, stats, steps, testimonials } from "@/content/site";
import { Counter } from "@/components/ui/Counter";
import { Reveal, RevealItem } from "@/components/ui/Reveal";
import { useCarouselState } from "@/components/ui/Carousel";
import { cn } from "@/lib/utils";

const STEP_ICONS = [Search, ClipboardCheck, Truck, PackageCheck];

/** Vertical timeline whose line "fills" as you scroll through it. */
export function StepsTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const height = useTransform(fill, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      <div className="absolute top-2 bottom-2 left-6 w-px bg-ink-200 md:left-1/2" aria-hidden>
        <motion.div style={{ height }} className="w-full bg-gradient-to-b from-brand-500 to-accent-500" />
      </div>
      <ol className="space-y-14">
        {steps.map((s, i) => {
          const Icon = STEP_ICONS[i];
          const right = i % 2 === 1;
          return (
            <li key={s.title} className={cn("relative grid items-center gap-6 pl-20 md:grid-cols-2 md:pl-0")}>
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="absolute left-0 grid size-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-card ring-1 ring-ink-900/5 md:left-1/2 md:-translate-x-1/2"
              >
                <Icon className="size-5" />
              </motion.span>
              <motion.div
                initial={{ opacity: 0, x: right ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ duration: 0.8 }}
                className={cn(right ? "md:col-start-2 md:pl-16" : "md:pr-16 md:text-right")}
              >
                <p className="text-xs font-bold tracking-widest text-accent-500">STEP 0{i + 1}</p>
                <h3 className="font-display mt-1 text-2xl font-bold">{s.title}</h3>
                <p className="mt-2 text-ink-500">{s.body}</p>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StatsBand() {
  return (
    <section className="relative overflow-hidden bg-ink-900 py-20 text-white">
      <div className="corrugated absolute inset-0" aria-hidden />
      <div className="absolute -top-40 -right-40 size-[480px] rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      <Reveal stagger={0.1} className="container-x relative grid grid-cols-2 gap-10 lg:grid-cols-4">
        {stats.map((s) => (
          <RevealItem key={s.label} className="border-l border-white/15 pl-6">
            <p className="font-display text-4xl font-extrabold text-white sm:text-5xl">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm text-ink-300">{s.label}</p>
          </RevealItem>
        ))}
      </Reveal>
      {/* TODO(client): confirm these figures are accurate before launch. */}
    </section>
  );
}

export function Testimonials() {
  const [ref, api] = useEmblaCarousel({ loop: true, align: "center" }, [Autoplay({ delay: 7000, stopOnMouseEnter: true, stopOnInteraction: false })]);
  const { selected, scrollTo, snaps } = useCarouselState(api);

  return (
    <div>
      <div className="embla" ref={ref}>
        <div className="embla__container">
          {testimonials.map((t, i) => (
            <div key={i} className="embla__slide basis-full px-4 md:basis-[70%]">
              <motion.figure
                animate={{ opacity: selected === i ? 1 : 0.35, scale: selected === i ? 1 : 0.94 }}
                transition={{ duration: 0.6 }}
                className="relative h-full rounded-[2rem] bg-white p-8 shadow-card ring-1 ring-ink-900/5 sm:p-12"
              >
                <Quote className="size-10 text-accent-500" aria-hidden />
                <blockquote className="font-display mt-6 text-xl leading-snug font-semibold text-balance text-ink-900 sm:text-2xl">“{t.quote}”</blockquote>
                <figcaption className="mt-8 flex items-center gap-4">
                  <span className="font-display grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white">
                    {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-sm text-ink-500">{t.role}</span>
                  </span>
                </figcaption>
              </motion.figure>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Choose testimonial">
        {Array.from({ length: snaps }).map((_, i) => (
          <button key={i} role="tab" aria-selected={selected === i} aria-label={`Testimonial ${i + 1}`} onClick={() => scrollTo(i)} className="h-2 rounded-full bg-ink-200 transition-all duration-500" style={{ width: selected === i ? 32 : 8, background: selected === i ? "var(--color-ink-900)" : undefined }} />
        ))}
      </div>
    </div>
  );
}

export function GalleryTeaser() {
  const shots = gallery.slice(0, 5);
  return (
    <Reveal stagger={0.08} className="grid auto-rows-[160px] grid-cols-2 gap-3 sm:auto-rows-[200px] md:grid-cols-4">
      {shots.map((g, i) => (
        <RevealItem key={g.src} className={cn("group relative overflow-hidden rounded-3xl bg-ink-200", i === 0 && "col-span-2 row-span-2")}>
          <Link href="/gallery" className="block size-full" aria-label={g.caption}>
            {g.type === "image" ? (
              <Image src={g.src} alt={g.caption} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.4s] group-hover:scale-110" />
            ) : (
              <>
                <video src={g.src} muted playsInline loop autoPlay preload="metadata" className="size-full object-cover" />
                <span className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/90 text-ink-900">
                  <Play className="size-4 fill-current" />
                </span>
              </>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-ink-950/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="absolute bottom-4 left-4 translate-y-3 text-sm font-medium text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">{g.caption}</span>
          </Link>
        </RevealItem>
      ))}
    </Reveal>
  );
}

export function TerminalMarquee({ terminals }: { terminals: string[] }) {
  const words = [...terminals, "20ft Standard", "40ft High Cube", "Nationwide delivery", "Free inspections"];
  return (
    <div className="relative overflow-hidden border-y border-ink-200 bg-white py-5" aria-hidden>
      <div className="flex w-max animate-marquee gap-12 hover:[animation-play-state:paused]">
        {[...words, ...words].map((w, i) => (
          <span key={i} className="font-display flex items-center gap-12 text-lg font-semibold whitespace-nowrap text-ink-400">
            {w}
            <span className="size-1.5 rounded-full bg-accent-500" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function CtaBand() {
  return (
    <Reveal className="container-x">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-600 px-6 py-14 text-white sm:px-14 sm:py-20">
        <div className="corrugated absolute inset-0 opacity-60" aria-hidden />
        <motion.div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-accent-500/40 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity }} aria-hidden />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">Not sure which container fits?</h2>
            <p className="mt-4 text-lg text-brand-100">Tell us what you need and our team will send a tailored quote within one business day.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="#quote" className="inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 font-semibold text-ink-900 transition-transform hover:-translate-y-0.5">
              Request a quote <ArrowRight className="size-4" />
            </Link>
            <Link href="/contact" className="inline-flex h-14 items-center rounded-full px-8 font-semibold ring-1 ring-white/40 transition-colors hover:bg-white/10">
              Talk to sales
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
