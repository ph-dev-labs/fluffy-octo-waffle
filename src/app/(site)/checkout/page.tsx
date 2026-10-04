import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const zones = await db.deliveryZone.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { code: true, label: true, perContainerKobo: true },
  });
  return (
    <section className="container-x min-h-[80vh] pt-32 pb-24">
      <h1 className="font-display mb-10 text-4xl font-extrabold tracking-tight sm:text-5xl">Checkout</h1>
      <CheckoutForm zones={zones} />
    </section>
  );
}
