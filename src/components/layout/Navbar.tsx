"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, ShoppingBag, X, Phone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { nav, site } from "@/content/site";
import { cartCount, useCart } from "@/store/cart";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "./Logo";

const noop = () => () => {};
/** true only after hydration — avoids SSR/localStorage mismatches for the cart badge */
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function Navbar() {
  const pathname = usePathname();
  const transparentTop = pathname === "/";
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const items = useCart((s) => s.items);
  const lastAddedAt = useCart((s) => s.lastAddedAt);
  const openDrawer = useCart((s) => s.openDrawer);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(items) : 0;

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    setHidden(y > 400 && y > prev && !open);
  });

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const solid = scrolled || !transparentTop || open;

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: hidden ? -96 : 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3"
      >
        <div
          className={cn(
            "container-x flex h-16 items-center justify-between rounded-2xl transition-all duration-500",
            solid ? "bg-white/80 shadow-card ring-1 ring-ink-900/5 backdrop-blur-xl" : "bg-transparent",
          )}
        >
          <Logo light={!solid} />

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    solid ? (active ? "text-ink-900" : "text-ink-500 hover:text-ink-900") : active ? "text-white" : "text-white/75 hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span layoutId="nav-pill" className={cn("absolute inset-0 rounded-full", solid ? "bg-ink-100" : "bg-white/15")} transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openDrawer}
              className={cn("relative grid size-11 place-items-center rounded-full transition-colors", solid ? "text-ink-900 hover:bg-ink-100" : "text-white hover:bg-white/10")}
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            >
              <motion.span key={lastAddedAt} animate={lastAddedAt ? { rotate: [0, -14, 10, -6, 0], scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.6 }}>
                <ShoppingBag className="size-5" />
              </motion.span>
              <AnimatePresence>
                {count > 0 ? (
                  <motion.span
                    key={count}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] leading-5 font-bold text-white"
                  >
                    {count}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </button>
            <ButtonLink href="/inspection" size="sm" variant={solid ? "primary" : "light"} className="hidden sm:inline-flex">
              Book inspection
            </ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn("grid size-11 place-items-center rounded-full lg:hidden", solid ? "text-ink-900 hover:bg-ink-100" : "text-white hover:bg-white/10")}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={open ? "x" : "m"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  {open ? <X className="size-5" /> : <Menu className="size-5" />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 bg-ink-950/96 backdrop-blur-xl lg:hidden"
            initial={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 44px) 44px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 44px) 44px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.nav
              aria-label="Mobile"
              className="container-x flex h-full flex-col justify-center gap-2"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } } }}
            >
              {[...nav, { href: "/inspection", label: "Book inspection" }, { href: "/cart", label: "Cart" }].map((item) => (
                <motion.div key={item.href} variants={{ hidden: { opacity: 0, x: -30 }, show: { opacity: 1, x: 0 } }}>
                  <Link href={item.href} className="font-display block py-2 text-4xl font-bold text-white/90 transition-colors hover:text-accent-500">
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.a variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} href={`tel:${site.phone.replace(/\s/g, "")}`} className="mt-8 inline-flex items-center gap-2 text-ink-300">
                <Phone className="size-4" /> {site.phone}
              </motion.a>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
