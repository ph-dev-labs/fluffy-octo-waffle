import type { Prisma } from "@prisma/client";

export const ORDER_FILTER_STATUSES = ["ALL", "PAID", "PENDING", "FAILED", "ABANDONED", "AMOUNT_MISMATCH", "REFUNDED"];

export type OrderFilters = { status?: string; q?: string; page?: string; review?: string; fulfilment?: string };

export function buildOrderWhere(sp: OrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (sp.status && ORDER_FILTER_STATUSES.includes(sp.status) && sp.status !== "ALL") where.status = sp.status;
  if (sp.review === "1") where.needsReview = true;
  if (sp.fulfilment === "open") where.fulfilmentStatus = { in: ["UNFULFILLED", "PROCESSING"] };
  const q = sp.q?.trim().slice(0, 80);
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
    ];
  }
  return where;
}
