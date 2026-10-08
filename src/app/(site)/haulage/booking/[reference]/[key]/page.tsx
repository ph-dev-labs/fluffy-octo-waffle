import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HaulageBooking } from "@/components/haulage/HaulageBooking";
import { getHaulageConfig } from "@/lib/haulage/service";
import { findBookingByLink, publicHaulage } from "@/lib/haulage/payments";

export const metadata: Metadata = { title: "Your truck booking", robots: { index: false, follow: false } };

export default async function BookingPage({ params }: { params: Promise<{ reference: string; key: string }> }) {
  const { reference, key } = await params;
  const booking = await findBookingByLink(reference, key);
  if (!booking) notFound();
  const cfg = await getHaulageConfig();
  return (
    <section className="container-x min-h-[85vh] pt-32 pb-24">
      <Suspense>
        <HaulageBooking initial={publicHaulage(booking)} linkKey={key} allowDeposit={cfg.allowDeposit} />
      </Suspense>
    </section>
  );
}
