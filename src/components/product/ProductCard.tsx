"use client";

import Image from "@/components/ui/SmartImage";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, MapPin, Plus, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/store/cart";
import { cn } from "@/lib/utils";

export interface CardData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  size: string;
  condition: string;
  terminal: string;
  priceKobo: number;
  image: string | null;
  inStock: boolean;
}

const SIZE_SHORT: Record<string, string> = { "20FT": "20ft", "40FT": "40ft", "40HC": "40ft HC", "45HC": "45ft HC" };
const COND: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Brand new", cls: "bg-success-100 text-success-600" },
  USED: { label: "Used", cls: "bg-warning-100 text-warning-600" },
  REFURBISHED: { label: "Refurbished", cls: "bg-brand-100 text-brand-700" },
};

export function ProductCard({ item, priority }: { item: CardData; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const cond = COND[item.condition] ?? COND.USED;

  const onAdd = () => {
    add({ containerId: item.id, snapshot: { title: item.title, slug: item.slug, image: item.image, priceKobo: item.priceKobo, size: item.size } });
    setAdded(true);
    toast.success(`${item.title} added to cart`);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink-900/5 transition-shadow duration-500 hover:shadow-lift"
    >
      <Link href={`/containers/${item.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-ink-100" aria-label={item.title}>
        {item.image ? (
          <Image src={item.image} alt={item.title} fill priority={priority} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 85vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent opacity-80" />
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-ink-900 backdrop-blur">{SIZE_SHORT[item.size] ?? item.size}</span>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", cond.cls)}>{cond.label}</span>
        </div>
        <span className="absolute top-4 right-4 grid size-10 translate-y-2 place-items-center rounded-full bg-white text-ink-900 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
        <p className="absolute bottom-4 left-4 flex items-center gap-1.5 text-xs font-medium text-white/90">
          <MapPin className="size-3.5" /> {item.terminal}
        </p>
        {!item.inStock ? <span className="absolute inset-0 grid place-items-center bg-ink-950/50 text-sm font-semibold tracking-wider text-white uppercase">Sold out</span> : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-bold tracking-tight">
          <Link href={`/containers/${item.slug}`} className="hover:text-brand-600">
            {item.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-500">{item.summary}</p>
        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <p className="text-xs text-ink-400">Price</p>
            <p className="font-display text-xl font-bold tabular-nums">{formatNaira(item.priceKobo)}</p>
          </div>
          <motion.button
            type="button"
            onClick={onAdd}
            disabled={!item.inStock}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "relative flex h-11 items-center gap-2 overflow-hidden rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-40",
              added ? "bg-success-600 text-white" : "bg-ink-900 text-white hover:bg-brand-600",
            )}
            aria-label={`Add ${item.title} to cart`}
          >
            <motion.span key={added ? "y" : "n"} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-2">
              {added ? <Check className="size-4" /> : <Plus className="size-4" />}
              {added ? "Added" : "Add"}
            </motion.span>
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-900/5">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-8 w-1/3 rounded" />
      </div>
    </div>
  );
}
