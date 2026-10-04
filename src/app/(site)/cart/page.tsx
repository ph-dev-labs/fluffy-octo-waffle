"use client";

import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, ShieldCheck, ShoppingBag, Trash2, RotateCw } from "lucide-react";
import { useCart } from "@/store/cart";
import { useCartPricing } from "@/lib/client/use-cart-pricing";
import { formatNaira } from "@/lib/money";
import { QtyStepper } from "@/components/cart/CartDrawer";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function CartPage() {
  const { data, error, loading, items, retry } = useCartPricing();
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const unavailable = data?.lines.filter((l) => !l.available) ?? [];

  return (
    <section className="container-x min-h-[70vh] pt-32 pb-24">
      <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Your cart
      </motion.h1>

      {loading && !data ? (
        <div className="mt-10 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-32 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-danger-100 p-6 text-danger-600">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5" /> {error}</p>
          <Button variant="secondary" onClick={retry} icon={<RotateCw className="size-4" />}>Try again</Button>
        </div>
      ) : !items.length ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10 flex flex-col items-center gap-4 rounded-[2rem] bg-white py-20 text-center ring-1 ring-ink-900/5">
          <span className="grid size-20 place-items-center rounded-full bg-brand-50 text-brand-600"><ShoppingBag className="size-8" /></span>
          <h2 className="font-display text-2xl font-bold">Your cart is empty</h2>
          <p className="text-ink-500">Browse verified containers across our terminals.</p>
          <ButtonLink href="/browse" icon={<ArrowRight className="size-4" />}>Browse containers</ButtonLink>
        </motion.div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {unavailable.length ? (
              <div className="flex items-start gap-3 rounded-2xl bg-warning-100 p-4 text-sm text-warning-600">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Some items are no longer available and won&apos;t be included at checkout.
              </div>
            ) : null}
            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {data?.lines.map((l) => {
                  const local = items.find((i) => i.containerId === l.containerId);
                  return (
                    <motion.li key={l.containerId} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: l.available ? 1 : 0.55, y: 0 }} exit={{ opacity: 0, x: -40 }} className="flex gap-4 rounded-3xl bg-white p-4 ring-1 ring-ink-900/5 sm:gap-6">
                      <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-2xl bg-ink-100 sm:w-40">
                        {(l.image ?? local?.snapshot.image) ? <Image src={(l.image ?? local?.snapshot.image)!} alt="" fill sizes="160px" className="object-cover" /> : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/containers/${l.slug ?? local?.snapshot.slug}`} className="font-display font-bold hover:text-brand-600">{l.title ?? local?.snapshot.title}</Link>
                            <p className="text-sm text-ink-500">{l.available ? `${l.terminal} · ${formatNaira(l.unitPriceKobo!)} each` : "No longer available"}</p>
                          </div>
                          <button onClick={() => remove(l.containerId)} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-danger-100 hover:text-danger-600" aria-label="Remove item">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        {l.available ? (
                          <div className="mt-auto flex items-end justify-between pt-3">
                            <QtyStepper value={local?.quantity ?? 1} max={Math.min(50, l.stock ?? 1)} onChange={(q) => setQuantity(l.containerId, q)} />
                            <p className="font-display text-lg font-bold tabular-nums">{formatNaira(l.lineTotalKobo!)}</p>
                          </div>
                        ) : null}
                        {l.available && local && l.quantity! < local.quantity ? <p className="mt-2 text-xs text-warning-600">Only {l.stock} in stock — quantity adjusted.</p> : null}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>

          <aside className="h-fit space-y-5 rounded-3xl bg-white p-6 ring-1 ring-ink-900/5 lg:sticky lg:top-28">
            <h2 className="font-display text-xl font-bold">Order summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Subtotal</span>
              <span className="font-semibold tabular-nums">{data ? formatNaira(data.subtotalKobo) : "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Delivery</span>
              <span className="text-ink-500">Calculated at checkout</span>
            </div>
            <div className="border-t border-ink-100 pt-4">
              <ButtonLink href="/checkout" size="lg" className="w-full" icon={<ArrowRight className="size-4" />} aria-disabled={!data?.subtotalKobo}>
                Proceed to checkout
              </ButtonLink>
            </div>
            <p className="flex items-center gap-2 text-xs text-ink-400"><ShieldCheck className="size-4 text-success-600" /> Secure payment via Paystack</p>
          </aside>
        </div>
      )}
    </section>
  );
}
