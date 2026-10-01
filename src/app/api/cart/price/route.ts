import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardPost, ok, parseJson } from "@/lib/http";
import { cartPriceSchema } from "@/lib/validation";
import { parseImages } from "@/lib/utils";

/**
 * Returns authoritative prices/availability for the items in a browser cart.
 * The cart in localStorage is only a list of ids; prices shown at checkout
 * always come from here.
 */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "cart-price", 60);
  if (blocked) return blocked;

  const parsed = await parseJson(req, cartPriceSchema);
  if ("error" in parsed) return parsed.error;

  const ids = [...new Set(parsed.data.items.map((i) => i.containerId))];
  const rows = await db.container.findMany({ where: { id: { in: ids }, active: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines = parsed.data.items.map((item) => {
    const c = byId.get(item.containerId);
    if (!c) return { containerId: item.containerId, available: false as const };
    const quantity = Math.min(item.quantity, Math.max(c.stock, 0));
    return {
      containerId: c.id,
      available: c.stock > 0,
      slug: c.slug,
      title: c.title,
      image: parseImages(c.images)[0] ?? null,
      size: c.size,
      terminal: c.terminal,
      unitPriceKobo: c.priceKobo,
      stock: c.stock,
      quantity,
      lineTotalKobo: c.priceKobo * quantity,
    };
  });

  const subtotalKobo = lines.reduce((sum, l) => sum + (l.available ? l.lineTotalKobo : 0), 0);
  return ok({ lines, subtotalKobo });
}
