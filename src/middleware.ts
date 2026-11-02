import { NextResponse, type NextRequest } from "next/server";

const IMAGE_HOSTS = ["https://pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev", "https://res.cloudinary.com"];
const ADMIN_COOKIES = ["__Host-cz_admin", "cz_admin"];
const SMARTSUPP_HOSTS = [
  "https://www.smartsupp.com",
  "https://www.smartsuppchat.com",
  "https://*.smartsupp.com",
  "https://*.smartsuppchat.com",
  "https://*.smartsuppcdn.com",
  "https://widget-v3.smartsuppcdn.com",
  "wss://*.smartsupp.com",
  "wss://*.smartsuppchat.com",
  "wss://*.smartsuppcdn.com",
  "https://*.smartsupp.io",
  "wss://*.smartsupp.io",
];

/**
 * Per-request nonce-based Content Security Policy. Next.js reads the nonce
 * from the request CSP header and applies it to its own scripts; the Paystack
 * inline script is loaded by our (trusted) bundle and allowed via
 * 'strict-dynamic'. Paystack's checkout runs inside an iframe (frame-src).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // Cheap first gate: no session cookie → straight to login. The real check
  // (DB-backed session, role, password-change) happens in requireAdmin().
  if (isAdmin && pathname !== "/admin/login" && !ADMIN_COOKIES.some((c) => req.cookies.has(c))) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.paystack.co ${SMARTSUPP_HOSTS.join(" ")} ${isDev ? "'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://*.paystack.co https://paystack.com ${SMARTSUPP_HOSTS.join(" ")}`,
    `img-src 'self' data: blob: ${IMAGE_HOSTS.join(" ")} https://tile.openstreetmap.org https://*.paystack.co https://*.paystack.com ${SMARTSUPP_HOSTS.join(" ")}`,
    `media-src 'self' ${IMAGE_HOSTS.join(" ")}`,
    `font-src 'self' data: https://*.paystack.co ${SMARTSUPP_HOSTS.join(" ")}`,
    `connect-src 'self' https://api.cloudinary.com https://api.paystack.co https://*.paystack.co https://*.paystack.com ${SMARTSUPP_HOSTS.join(" ")} ${isDev ? "ws:" : ""}`,
    `frame-src https://checkout.paystack.com https://*.paystack.co https://*.paystack.com ${SMARTSUPP_HOSTS.join(" ")}`,
    `form-action 'self' https://checkout.paystack.com https://*.smartsupp.com https://*.smartsuppchat.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  if (isAdmin) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: [
    // Skip static assets, images and API routes (JSON, no HTML to protect).
    { source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp4)$).*)" },
  ],
};
