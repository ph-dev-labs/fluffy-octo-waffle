// Server-authoritative pricing rules. The browser NEVER sends a price or total;
// it only sends container ids + quantities and every amount is computed here.
//
// Delivery rates live in the DeliveryZone table and are edited in /admin/delivery.
// The values below are only the initial seed.

export const CURRENCY = "NGN";

export const DEFAULT_DELIVERY_ZONES = {
  LAGOS: { label: "Lagos (within state)", perContainerKobo: 150_000_00 },
  SOUTH_WEST: { label: "Ogun, Oyo, Osun, Ondo, Ekiti", perContainerKobo: 300_000_00 },
  SOUTH: { label: "South-South & South-East", perContainerKobo: 450_000_00 },
  NORTH: { label: "North (all states incl. FCT)", perContainerKobo: 600_000_00 },
} as const;

export interface ZoneOption {
  code: string;
  label: string;
  perContainerKobo: number;
}

export function deliveryFeeKobo(zone: Pick<ZoneOption, "perContainerKobo"> | null | undefined, containerCount: number): number {
  return zone ? zone.perContainerKobo * containerCount : 0;
}

/** Paystack's maximum single NGN transaction is well above this; keep a sane ceiling. */
export const MAX_ORDER_KOBO = 500_000_000_00;
