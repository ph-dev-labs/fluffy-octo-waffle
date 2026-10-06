import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { site } from "@/content/site";
import "./globals.css";

// Self-hosted (latin, variable weight) so builds never depend on reaching Google Fonts.
const body = localFont({
  src: "../fonts/plus-jakarta-sans-latin.woff2",
  weight: "200 800",
  variable: "--font-body",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});
const display = localFont({
  src: "../fonts/sora-latin.woff2",
  weight: "100 800",
  variable: "--font-display-face",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: safeBaseUrl(),
  title: { default: `${site.name} | ${site.seoTitle}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: site.keywords,
  authors: [{ name: site.legalName }],
  creator: site.legalName,
  publisher: site.legalName,
  category: "business",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: site.legalName,
    title: `${site.name} | ${site.seoTitle}`,
    description: site.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: `${site.name} | ${site.seoTitle}`, description: site.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  // Add the codes from Google Search Console / Bing Webmaster Tools when available.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
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
  themeColor: "#192440",
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
        <MotionProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </MotionProvider>
      </body>
    </html>
  );
}
