"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The cart stores ids + quantities and a display snapshot. Prices shown at
 * checkout are always re-fetched from the server (/api/cart/price); the
 * snapshot is only for instant UI (e.g. the drawer).
 */
export interface CartItem {
  containerId: string;
  quantity: number;
  snapshot: { title: string; slug: string; image: string | null; priceKobo: number; size: string };
}

interface CartState {
  items: CartItem[];
  drawerOpen: boolean;
  lastAddedAt: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (containerId: string, quantity: number) => void;
  remove: (containerId: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const MAX_QTY = 50;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      drawerOpen: false,
      lastAddedAt: 0,
      add: (item, quantity = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.containerId === item.containerId);
          const items = existing
            ? s.items.map((i) =>
                i.containerId === item.containerId ? { ...i, snapshot: item.snapshot, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i,
              )
            : [...s.items, { ...item, quantity: Math.min(MAX_QTY, quantity) }].slice(-20);
          return { items, drawerOpen: true, lastAddedAt: Date.now() };
        }),
      setQuantity: (containerId, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.containerId === containerId ? { ...i, quantity: Math.max(1, Math.min(MAX_QTY, quantity)) } : i)),
        })),
      remove: (containerId) => set((s) => ({ items: s.items.filter((i) => i.containerId !== containerId) })),
      clear: () => set({ items: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "cz.cart.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      version: 1,
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
