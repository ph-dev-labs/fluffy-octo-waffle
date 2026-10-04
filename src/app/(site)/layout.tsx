import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PendingPaymentBanner } from "@/components/layout/PendingPaymentBanner";

/** Public storefront chrome. The admin area (/admin) has its own layout. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <Navbar />
      <main id="main">{children}</main>
      <Footer />
      <CartDrawer />
      <PendingPaymentBanner />
    </>
  );
}

function SkipLink() {
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
      Skip to content
    </a>
  );
}
