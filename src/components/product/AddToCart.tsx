"use client";

import { useRouter } from "next/navigation";
import { ShoppingBag, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { QtyStepper } from "@/components/cart/CartDrawer";
import { useCart } from "@/store/cart";
import { formatNaira } from "@/lib/money";
import type { CardData } from "./ProductCard";

export function AddToCart({ item, stock }: { item: CardData; stock: number }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const closeDrawer = useCart((s) => s.closeDrawer);
  const [qty, setQty] = useState(1);
  const max = Math.max(1, Math.min(50, stock));

  const doAdd = () => {
    add({ containerId: item.id, snapshot: { title: item.title, slug: item.slug, image: item.image, priceKobo: item.priceKobo, size: item.size } }, qty);
    toast.success(`${qty} × ${item.title} added to cart`);
  };

  if (stock <= 0) {
    return (
      <div className="rounded-2xl bg-warning-100 p-4 text-sm text-warning-600">
        This unit is currently sold out. Request a quote and we&apos;ll source one for you.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-ink-50 p-4">
        <div>
          <p className="text-xs text-ink-400">Quantity</p>
          <p className="text-xs text-ink-500">{stock} available</p>
        </div>
        <QtyStepper value={qty} onChange={setQty} max={max} />
        <p className="font-display text-lg font-bold tabular-nums">{formatNaira(item.priceKobo * qty)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" variant="secondary" onClick={doAdd} icon={<ShoppingBag className="size-4" />}>
          Add to cart
        </Button>
        <Button
          size="lg"
          onClick={() => {
            doAdd();
            closeDrawer();
            router.push("/checkout");
          }}
          icon={<Zap className="size-4" />}
        >
          Buy now
        </Button>
      </div>
    </div>
  );
}
