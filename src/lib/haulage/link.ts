import "server-only";
import type { HaulagePayment, HaulageRequest } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { deriveSecret, secretMatches } from "@/lib/delivery/quote-token";

// Each booking has a private link (/haulage/booking/HL-XXXXXXX/<key>). The key is
// derived from the booking id with a server secret, so it can be re-sent in
// any email without being stored, and can't be guessed from the reference.

const LINK_PURPOSE = "cz-haulage-link-v1";
export const bookingKey = (id: string) => deriveSecret(LINK_PURPOSE, id);
export const bookingPath = (r: Pick<HaulageRequest, "id" | "reference">) => `/haulage/booking/${r.reference}/${bookingKey(r.id)}`;
export const bookingUrl = (r: Pick<HaulageRequest, "id" | "reference">) => `${env().APP_URL}${bookingPath(r)}`;

/** Loads a booking only if the link's key matches. */
export async function findBookingByLink(reference: string, key: string | null | undefined): Promise<(HaulageRequest & { payments: HaulagePayment[] }) | null> {
  if (!key || !/^HL-[A-Z0-9]{7}$/.test(reference)) return null;
  const r = await db.haulageRequest.findUnique({ where: { reference }, include: { payments: { orderBy: { createdAt: "asc" } } } });
  if (!r || !secretMatches(LINK_PURPOSE, r.id, key)) return null;
  return r;
}

