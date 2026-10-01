"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/store/cart";
import { fetchJson } from "./fetch-json";

export interface PricedLine {
  containerId: string;
  available: boolean;
  slug?: string;
  title?: string;
  image?: string | null;
  size?: string;
  terminal?: string;
  unitPriceKobo?: number;
  stock?: number;
  quantity?: number;
  lineTotalKobo?: number;
}

interface Priced {
  lines: PricedLine[];
  subtotalKobo: number;
}

/** Fetches authoritative prices for the local cart (re-runs when the cart changes). */
export function useCartPricing() {
  const items = useCart((s) => s.items);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<Priced | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const unsub = useCart.persist.onFinishHydration(() => setHydrated(true));
    if (useCart.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const key = useMemo(() => JSON.stringify(items.map((i) => [i.containerId, i.quantity])), [items]);

  useEffect(() => {
    if (!hydrated) return;
    if (!items.length) {
      setData({ lines: [], subtotalKobo: 0 });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<Priced>("/api/cart/price", {
      method: "POST",
      json: { items: items.map((i) => ({ containerId: i.containerId, quantity: i.quantity })) },
      retries: 3,
    })
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, nonce]);

  return { items, data, error, loading: loading || !hydrated, hydrated, retry: () => setNonce((n) => n + 1) };
}
