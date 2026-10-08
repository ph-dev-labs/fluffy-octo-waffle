import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deliveryTotalKobo } from "@/lib/delivery/calc";
import { signQuote } from "@/lib/delivery/quote-token";
import { quoteDelivery } from "@/lib/delivery/service";
import { apiError, guardPost, ok, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { cartLineSchema } from "@/lib/validation";

export const runtime = "nodejs";

const zoneCode = z.string().regex(/^[A-Z0-9_]{2,40}$/);
const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  stateCode: zoneCode.nullish(),
  areaCode: zoneCode.nullish(),
  items: z.array(cartLineSchema).max(20).optional(),
});

/**
 * POST /api/delivery/quote
 * Prices delivery to a map pin and returns a signed quote that checkout
 * charges exactly. Without `items` (admin "test a location") it returns the
 * per-container fees only.
 */
export async function POST(req: NextRequest) {
  const blocked = guardPost(req, "delivery-quote", 30);
  if (blocked) return blocked;
  const parsed = await parseJson(req, schema);
  if ("error" in parsed) return parsed.error;
  const { lat, lng, stateCode, areaCode, items } = parsed.data;

  try {
    const outcome = await quoteDelivery({ lat, lng, stateCode, areaCode });
    if (!outcome.ok) return ok(outcome);

    const { ok: _ok, ...fields } = outcome;
    void _ok;
    const { token } = signQuote({ ...fields, lat, lng });

    let totalKobo: number | null = null;
    let containerCount = 0;
    if (items?.length) {
      const containers = await db.container.findMany({ where: { id: { in: items.map((i) => i.containerId) } }, select: { id: true, size: true } });
      const sizeOf = new Map(containers.map((c) => [c.id, c.size]));
      const units = items.filter((i) => sizeOf.has(i.containerId)).map((i) => ({ size: sizeOf.get(i.containerId)!, quantity: i.quantity }));
      containerCount = units.reduce((n, u) => n + u.quantity, 0);
      totalKobo = deliveryTotalKobo(outcome.perSize, units, outcome.perSize["20FT"] ?? 0);
    }
    return ok({ ...outcome, token, totalKobo, containerCount });
  } catch (err) {
    logger.error("delivery.quote_failed", { error: err });
    return apiError(503, "QUOTE_FAILED", "We couldn't price this delivery right now. Please try again.", { retryable: true });
  }
}
