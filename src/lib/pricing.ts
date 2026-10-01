// Server-authoritative pricing rules. The browser NEVER sends a price or total;
// it only sends container ids + quantities and every amount is computed here.
//
// TODO(client): confirm real delivery rates with C-ZUCHI operations.

export const CURRENCY = "NGN";

export const DELIVERY_ZONES = {
  LAGOS: { label: "Lagos (within state)", perContainerKobo: 150_000_00 },
  SOUTH_WEST: { label: "Ogun, Oyo, Osun, Ondo, Ekiti", perContainerKobo: 300_000_00 },
  SOUTH: { label: "South-South & South-East", perContainerKobo: 450_000_00 },
  NORTH: { label: "North (all states incl. FCT)", perContainerKobo: 600_000_00 },
} as const;

export type DeliveryZone = keyof typeof DELIVERY_ZONES;
export const DELIVERY_ZONE_KEYS = Object.keys(DELIVERY_ZONES) as [DeliveryZone, ...DeliveryZone[]];

export function deliveryFeeKobo(zone: DeliveryZone | null | undefined, containerCount: number): number {
  if (!zone) return 0;
  return DELIVERY_ZONES[zone].perContainerKobo * containerCount;
}

/** Paystack's maximum single NGN transaction is well above this; keep a sane ceiling. */
export const MAX_ORDER_KOBO = 500_000_000_00;
