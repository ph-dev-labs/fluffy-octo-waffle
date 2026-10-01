"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Search, ShieldCheck, Truck, Eye } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { heroSlides } from "@/content/site";
import { useCarouselState } from "@/components/ui/Carousel";
import { ButtonLink } from "@/components/ui/Button";
import { WordsReveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

const SLIDE_MS = 6500;
const QUICK = ["20ft", "40ft High Cube", "Brand new", "Apapa"];

export function Hero() {
  const [emblaRef, api] = useEmblaCarousel({ loop: true, duration: 40 }, [
    Fade(),
    Autoplay({ delay: SLIDE_MS, stopOnInteraction: false, stopOnMouseEnter: false }),
  ]);
  const { selected, scrollTo } = useCarouselState(api);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const slide = heroSlides[selected] ?? heroSlides[0];

  return (
    <section ref={sectionRef} className="relative isolate h-[100svh] min-h-[640px] overflow-hidden bg-ink-950">
      {/* Background slides */}
      <div className="embla absolute inset-0 -z-10" ref={emblaRef}>
        <div className="embla__container h-full">
          {heroSlides.map((s, i) => (
            <div key={s.image} className="embla__slide relative h-full basis-full">
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={selected === i ? { scale: [1.12, 1] } : { scale: 1.12 }}
                transition={{ duration: SLIDE_MS / 1000 + 1.5, ease: "linear" }}
              >
                <Image src={s.image} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
              </motion.div>
            </div>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/80 via-ink-950/55 to-ink-950" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgb(51_105_255/0.35),transparent_55%)]" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="container-x flex h-full flex-col justify-center pt-24 pb-28">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white ring-1 ring-white/20 backdrop-blur">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent-500" />
          </span>
          <AnimatePresence mode="wait">
            <motion.span key={slide.eyebrow} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {slide.eyebrow}
            </motion.span>
          </AnimatePresence>
        </motion.p>

        <h1 className="font-display mt-6 max-w-4xl text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-balance text-white sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
          <WordsReveal text="Your trusted" delay={0.15} /> <WordsReveal text="shipping container" delay={0.3} className="text-accent-500" />{" "}
          <WordsReveal text="plug." delay={0.5} />
        </h1>

        <div className="mt-6 h-14 max-w-xl sm:h-12">
          <AnimatePresence mode="wait">
            <motion.p key={slide.body} initial={{ opacity: 0, y: 12, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.5 }} className="text-base text-ink-200 sm:text-lg">
              {slide.body}
            </motion.p>
          </AnimatePresence>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.8 }} className="mt-8 max-w-2xl">
          <HeroSearch />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/browse" size="lg" variant="accent" icon={<ArrowRight className="size-4" />}>
            Browse containers
          </ButtonLink>
          <ButtonLink href="/inspection" size="lg" variant="outline-light">
            Book an inspection
          </ButtonLink>
        </motion.div>
      </motion.div>

      {/* Slide indicators with autoplay progress */}
      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-ink-950/40 backdrop-blur-md">
        <div className="container-x grid grid-cols-3">
          {heroSlides.map((s, i) => (
            <button
              key={s.image}
              type="button"
              onClick={() => scrollTo(i)}
              className="group relative py-5 pr-4 text-left"
              aria-label={`Show slide ${i + 1}: ${s.eyebrow}`}
              aria-current={selected === i}
            >
              <span className="absolute inset-x-0 top-0 h-0.5 bg-white/10">
                {selected === i ? (
                  <motion.span key={`p-${selected}`} className="absolute inset-y-0 left-0 bg-accent-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: SLIDE_MS / 1000, ease: "linear" }} />
                ) : null}
              </span>
              <span className={cn("block text-xs font-semibold tabular-nums transition-colors", selected === i ? "text-accent-500" : "text-white/40")}>0{i + 1}</span>
              <span className={cn("mt-1 hidden text-sm font-medium transition-colors sm:block", selected === i ? "text-white" : "text-white/50 group-hover:text-white/80")}>{s.eyebrow}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim().slice(0, 80);
    router.push(query ? `/browse?q=${encodeURIComponent(query)}` : "/browse");
  };
  return (
    <div>
      <form onSubmit={submit} role="search" className="group flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-lift ring-4 ring-white/10 transition-shadow focus-within:ring-brand-500/40">
        <Search className="size-5 shrink-0 text-ink-400" aria-hidden />
        <label htmlFor="hero-search" className="sr-only">
          Search containers
        </label>
        <input
          id="hero-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={80}
          placeholder="Search by size, type or terminal…"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
        />
        <button type="submit" className="h-12 shrink-0 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
          Search
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
        <span>Popular:</span>
        {QUICK.map((t) => (
          <button key={t} type="button" onClick={() => router.push(`/browse?q=${encodeURIComponent(t)}`)} className="rounded-full bg-white/10 px-3 py-1 text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/20">
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrustStrip() {
  const items = [
    { icon: ShieldCheck, title: "Verified inventory", body: "Every unit inspected before listing." },
    { icon: Eye, title: "Inspect before you buy", body: "Free terminal viewings, any weekday." },
    { icon: Truck, title: "Nationwide delivery", body: "Flatbed delivery to all 36 states." },
  ];
  return (
    <div className="relative z-10 -mt-px bg-white">
      <div className="container-x grid divide-y divide-ink-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map(({ icon: Icon, title, body }, i) => (
          <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="group flex items-center gap-4 py-7 md:px-8 md:first:pl-0">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-all duration-500 group-hover:rotate-6 group-hover:bg-brand-600 group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-ink-500">{body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
