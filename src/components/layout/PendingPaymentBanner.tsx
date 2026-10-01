"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { readPending, type PendingPayment } from "@/lib/client/pending-payment";
import { formatNaira } from "@/lib/money";

/**
 * If a customer left mid-payment (tab closed, network died), remind them on
 * every page that we're still confirming it — and discourage paying twice.
 */
export function PendingPaymentBanner() {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingPayment | null>(null);

  useEffect(() => {
    const sync = () => setPending(readPending());
    sync();
    window.addEventListener("cz:pending-payment", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cz:pending-payment", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const show = pending && !pathname.startsWith("/checkout");

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl bg-ink-900 p-4 text-white shadow-lift sm:inset-x-auto sm:right-4"
          role="status"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 shrink-0 animate-spin text-accent-500" aria-hidden />
            <p className="flex-1 text-sm">
              We&apos;re confirming your payment of <strong>{formatNaira(pending.amountKobo)}</strong>. Please don&apos;t pay again.
            </p>
            <Link href={`/checkout/status?reference=${encodeURIComponent(pending.reference)}`} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink-900 hover:bg-ink-100">
              View status
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
