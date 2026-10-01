import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentStatus } from "@/components/checkout/PaymentStatus";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

export default function StatusPage() {
  return (
    <section className="container-x flex min-h-[85vh] items-center pt-32 pb-24">
      <div className="w-full">
        <Suspense>
          <PaymentStatus />
        </Suspense>
      </div>
    </section>
  );
}
