import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <section className="container-x min-h-[80vh] pt-32 pb-24">
      <h1 className="font-display mb-10 text-4xl font-extrabold tracking-tight sm:text-5xl">Checkout</h1>
      <CheckoutForm />
    </section>
  );
}
