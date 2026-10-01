"use client";

import { AnimatePresence, motion } from "motion/react";
import { PackageSearch } from "lucide-react";
import { ProductCard, type CardData } from "./ProductCard";
import { ButtonLink } from "@/components/ui/Button";

export function ProductGrid({ items }: { items: CardData[] }) {
  if (!items.length) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 rounded-3xl bg-white py-20 text-center ring-1 ring-ink-900/5">
        <PackageSearch className="size-12 text-ink-300" />
        <h2 className="font-display text-xl font-bold">No containers match those filters</h2>
        <p className="max-w-sm text-ink-500">Try a different size or condition — or request a quote and we&apos;ll source it for you.</p>
        <div className="flex gap-3">
          <ButtonLink href="/browse" variant="secondary">Clear filters</ButtonLink>
          <ButtonLink href="#quote">Request a quote</ButtonLink>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.ul layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(i, 8) * 0.05 } }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
          >
            <ProductCard item={item} priority={i < 3} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
