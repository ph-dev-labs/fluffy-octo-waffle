import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.paystack.com\")" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // react-pdf ships its own layout engine; run it as a plain Node module rather than bundling it.
  serverExternalPackages: ["@react-pdf/renderer"],
  // pdfkit (used by react-pdf) loads its built-in fonts and colour profile by a
  // path computed at runtime, so Vercel's file tracing can't see them. Ship them
  // explicitly with every function that renders invoices (PDF route + the order
  // page, whose server action renders the PDF for email).
  outputFileTracingIncludes: {
    "/api/admin/invoices/**": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/pdfkit/js/data/**/*"],
    "/admin/orders/**": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/pdfkit/js/data/**/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
