import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { PendingPaymentBanner } from "@/components/layout/PendingPaymentBanner";
import { site } from "@/content/site";
import "./globals.css";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Sora({ subsets: ["latin"], variable: "--font-display-face", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: safeBaseUrl(),
  title: { default: `${site.name} | Shipping Container Marketplace`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, title: `${site.name} | Shipping Container Marketplace`, description: site.description },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

/** Never let a malformed APP_URL (e.g. missing https://) take down every page. */
function safeBaseUrl() {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000");
  } catch {
    console.error(`[layout] Invalid APP_URL "${process.env.APP_URL}" — it must include https://`);
    return new URL("http://localhost:3000");
  }
}

export const viewport: Viewport = {
  themeColor: "#0a1128",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts every page into dynamic rendering, which the
  // nonce-based CSP in middleware.ts requires (static HTML can't carry a per-request nonce).
  await headers();
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        <MotionProvider>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
          <PendingPaymentBanner />
          <Toaster position="top-center" richColors closeButton />
        </MotionProvider>
      </body>
    </html>
  );
}
