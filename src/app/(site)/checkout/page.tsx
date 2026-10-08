import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { listDeliveryStates } from "@/lib/delivery/service";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const states = await listDeliveryStates();
  return (
    <section className="container-x min-h-[80vh] pt-32 pb-24">
      <h1 className="font-display mb-10 text-4xl font-extrabold tracking-tight sm:text-5xl">Checkout</h1>
      <CheckoutForm states={states} />
    </section>
  );
}
