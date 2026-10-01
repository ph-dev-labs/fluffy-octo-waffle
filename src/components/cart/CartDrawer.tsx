"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useCart } from "@/store/cart";
import { formatNaira } from "@/lib/money";
import { ButtonLink } from "@/components/ui/Button";

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, setQuantity, remove } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const subtotal = items.reduce((s, i) => s + i.snapshot.priceKobo * i.quantity, 0);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerOpen ? (
        <div className="fixed inset-0 z-[60]">
          <motion.div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl outline-none"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
          >
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-5">
              <h2 className="font-display text-xl font-bold">Your cart</h2>
              <button onClick={closeDrawer} className="grid size-10 place-items-center rounded-full hover:bg-ink-100" aria-label="Close cart">
                <X className="size-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid size-20 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <ShoppingBag className="size-8" />
                </motion.div>
                <p className="font-display text-lg font-semibold">Your cart is empty</p>
                <p className="text-sm text-ink-500">Browse verified containers across our terminals.</p>
                <ButtonLink href="/browse" onClick={closeDrawer}>
                  Browse containers
                </ButtonLink>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.li
                        key={item.containerId}
                        layout
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 60, height: 0, marginTop: 0 }}
                        className="flex gap-4 rounded-2xl border border-ink-100 p-3"
                      >
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                          {item.snapshot.image ? <Image src={item.snapshot.image} alt="" fill sizes="80px" className="object-cover" /> : null}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link href={`/containers/${item.snapshot.slug}`} onClick={closeDrawer} className="truncate font-semibold hover:text-brand-600">
                            {item.snapshot.title}
                          </Link>
                          <p className="text-sm text-ink-500">{formatNaira(item.snapshot.priceKobo)}</p>
                          <div className="mt-auto flex items-center justify-between">
                            <QtyStepper value={item.quantity} onChange={(q) => setQuantity(item.containerId, q)} />
                            <button onClick={() => remove(item.containerId)} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-danger-100 hover:text-danger-600" aria-label={`Remove ${item.snapshot.title}`}>
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="space-y-4 border-t border-ink-100 px-6 py-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-ink-500">Estimated subtotal</span>
                    <span className="font-display text-2xl font-bold">{formatNaira(subtotal)}</span>
                  </div>
                  <p className="text-xs text-ink-400">Final prices and delivery are confirmed at checkout.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <ButtonLink href="/cart" variant="secondary" onClick={closeDrawer}>
                      View cart
                    </ButtonLink>
                    <ButtonLink href="/checkout" onClick={closeDrawer}>
                      Checkout
                    </ButtonLink>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function QtyStepper({ value, onChange, max = 50 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-full bg-ink-100 p-1">
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} className="grid size-7 place-items-center rounded-full hover:bg-white disabled:opacity-40" aria-label="Decrease quantity">
        <Minus className="size-3.5" />
      </button>
      <span className="w-8 overflow-hidden text-center text-sm font-semibold tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="inline-block" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="grid size-7 place-items-center rounded-full hover:bg-white disabled:opacity-40" aria-label="Increase quantity">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
