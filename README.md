# C-ZUCHI — Shipping Container Marketplace

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Motion (Framer Motion) · Embla Carousel · Prisma · Zod · Paystack

## Quick start

```bash
cp .env.example .env          # fill in DATABASE_URL (Postgres), PAYSTACK_SECRET_KEY, CRON_SECRET
npm install
npm run db:migrate            # create tables
npm run db:seed               # sample inventory (run once per database)
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `start` | Next.js |
| `npm run build` | Applies pending DB migrations, then builds (this is what Vercel runs) |
| `npm run db:migrate` / `db:seed` | Apply migrations / load starter content + create the first owner admin |
| `npm test` | Payment state machine, webhook signature, password hashing, Cloudinary signing, DB concurrency tests |
| `npm run typecheck` / `lint` | Static checks |

## Project layout

```
src/
  app/                    routes (pages + API)
    api/checkout          create/resume order + Paystack transaction (idempotent)
    api/payments/verify   status poller → verifies with Paystack
    api/payments/webhook  signed Paystack webhook
    api/payments/reconcile  cron safety net
    api/cart/price        authoritative cart pricing
    api/{quote,inspection,contact}
  components/             ui/ (Button, Carousel, Field, Reveal…), home/, product/, checkout/, gallery/, layout/
  lib/                    server logic (payments, paystack, catalog, http, env…) + client/ helpers
  content/site.ts         brand copy, contact details, hero slides, gallery  ← edit here
  middleware.ts           per-request nonce CSP
prisma/                   schema + seed
tests/                    node:test suites
```

## Admin panel (`/admin`)

| Area | What admins can do |
| --- | --- |
| Dashboard | 30-day revenue, orders to fulfil, pending payments, new requests, low stock, 14-day revenue chart |
| Orders | Filter, search, export CSV; per order: fulfilment status + internal notes, **re-verify with Paystack**, resend receipt, resolve "needs review" |
| Containers | Create, edit, hide, feature, archive; photos uploaded to Cloudinary (drag to reorder, first = cover) |
| Requests | Quotes, inspection bookings and contact messages; mark handled / delete |
| Delivery rates | Per-region rate per container, used live by checkout |
| Gallery / Testimonials | Manage photos, videos and quotes shown on the site |
| Admin users *(owner)* | Add admins (one-time temporary password), reset passwords, deactivate, change role |
| Audit log *(owner)* | Every sign-in, failed sign-in and change, with who, when and IP |

**Admins can never mark an order as paid by hand.** Payment status only comes from Paystack, so a mistake or a compromised admin account can't create fake "paid" orders.

**First owner account.** Set `ADMIN_SEED_EMAIL`, then run `npm run db:seed` **in your own terminal**. The temporary password is printed once, and the owner has to change it at first sign-in. Re-running the seed never overwrites an existing account or any content an admin has edited.

**How admin access is secured**
- **Passwords** are hashed with scrypt.
- **Sessions** live in the database: a random 256-bit token sits in an `HttpOnly`, `SameSite=Strict`, `__Host-` cookie with a 12-hour lifetime.
- **Brute-force protection:** each account locks for 15 minutes after 5 failed attempts, and login attempts are also rate-limited per IP.
- **Password changes** sign out every other device.
- **Every page and server action** re-checks the session and role. Middleware is only a convenience redirect.
- **Forms** use Next.js server actions, which reject cross-site requests by checking the request origin.
- **CSV exports** are protected against spreadsheet-formula injection.

## Images & video (Cloudinary)

- **Uploads:** admins upload straight from the browser to Cloudinary using a short-lived **signature** that our server issues only to signed-in admins. The signature pins the folder and the allowed file types. The API secret never reaches the browser, and Vercel's 4.5 MB request limit doesn't apply.
- **Delivery:** images are served through Cloudinary with `f_auto,q_auto` and width-based resizing (`src/lib/media.ts` and `components/ui/SmartImage.tsx`), so browsers get AVIF or WebP at the right size. Videos get `q_auto,vc_auto`, plus a poster frame.
- **Accepted URLs:** the server only saves media URLs from **our** Cloudinary cloud and folder (or the legacy R2 bucket).
- **Deleting:** removing or replacing media also deletes it from Cloudinary.

## Email (Resend)

These emails are sent through [Resend](https://resend.com) (`src/lib/mail.ts`):
- the customer's payment receipt
- a "new paid order" alert to staff
- alerts for new quotes, inspection bookings and contact messages

**One receipt per order:** the send is "claimed" in the database before it goes out. If sending fails, the claim is released and the reconciliation cron retries.

**Without `RESEND_API_KEY`** emails are skipped with a log line, and nothing else breaks.

**Setup:**
1. Verify the `c-zuchigrp.com` domain in Resend. That means adding the SPF, DKIM and DMARC records it gives you to your DNS.
2. Set `MAIL_FROM`, e.g. `C-ZUCHI <orders@c-zuchigrp.com>`, and `MAIL_ADMIN_TO`.

## Invoices

After an order is **paid** and marked **Delivered** or **Collected**, an admin opens the order and fills in the **Invoice** panel:

1. Enter the container number for each unit (e.g. `CSQU 305438 3`). Numbers are checked against the **ISO 6346 check digit**, so a mistyped digit is caught before it goes on an invoice. An admin can override the check after confirming against the container door. Duplicate numbers on the same order or on another invoice are rejected.
2. **Save draft**, then **Preview PDF**. Drafts carry a DRAFT watermark.
3. **Generate & send** emails the PDF to the customer via Resend, with replies going to sales. Invoices can be edited and resent; every action is audit-logged.

**The PDF** (`src/lib/invoice/InvoiceDocument.tsx`) is an A4 page containing:
- the logo and company header
- billed-to and delivered-to blocks
- one line per container with its number
- totals and a PAID stamp with the payment date, channel and Paystack reference

**Invoice numbers** are sequential: `INV-<year>-<00001>`. Fill in `site.rcNumber` in `src/content/site.ts` to show the CAC registration number.

## Branding & SEO

- **Logo assets** (transparent PNGs) live in `public/brand/`: the full lockup, the mark, and white variants for dark backgrounds. Favicons and the social preview image are `src/app/icon.png`, `apple-icon.png`, `favicon.ico` and `opengraph-image.png`. Ask the client for an **SVG** logo for the sharpest results.
- **Structured data** (`src/lib/seo.tsx`): Organization and WebSite (with sitelinks search) on every page; Product with Offer and BreadcrumbList on container pages; FAQPage on How it works.
- **Indexing:**
  - Every public page has its own title, description and canonical URL.
  - Filtered or search result pages are `noindex, follow`.
  - The sitemap has priorities, there's a web manifest, and Open Graph and Twitter cards are set.
- **After launch:** add the site to Google Search Console (set `GOOGLE_SITE_VERIFICATION`), submit `/sitemap.xml`, and create a Google Business Profile for the Apapa office.

## Payments: how money is kept safe

**Golden rule:** The browser never decides prices or whether a payment succeeded. Only Paystack's API does, and only when our server asks it.

1. **Server-side pricing.** The cart only stores ids and quantities. `/api/checkout` loads prices from the database, adds the delivery fee (`lib/pricing.ts`), and calculates the total in integer kobo.
2. **Order saved before payment.** The order is written as `PENDING` before Paystack is called. A payment always has an order behind it.
3. **Idempotency key.** Each checkout attempt sends a UUID derived from the payload. If the network drops and the browser retries, it gets the **same** order and access code back, so a customer can't be charged twice. Concurrent duplicate requests are resolved by a unique constraint.
4. **Reference rotation.** If initialising with Paystack times out, the next attempt uses a fresh reference. Only a reference whose access code we returned can ever be paid.
5. **Three independent confirmation paths.** All of them call the same idempotent `applyTransaction`:
   - **Status page polling** (`/checkout/status`): backs off exponentially, pauses while offline, and resumes when the connection or tab comes back.
   - **Webhook** (`/api/payments/webhook`): HMAC-SHA512 signature checked over the raw body in constant time, optional IP allowlist, events de-duplicated, and the result **re-verified with the API** rather than trusting the payload. It returns 5xx on failure so Paystack retries.
   - **Reconciliation cron** (`/api/payments/reconcile`): every 10 minutes (GitHub Actions, plus a daily Vercel cron) it re-verifies any unconfirmed order from the last 72 hours. This catches the case where the customer's phone died **and** the webhook was lost.
6. **Strict checks before PAID.** The amount, currency and reference must all match exactly. Anything else becomes `AMOUNT_MISMATCH`, gets flagged `needsReview`, and is never fulfilled automatically.
7. **No double effects.** Every status change is a conditional `updateMany`, so stock is decremented exactly once even under concurrent confirmations (see `tests/apply-transaction.test.ts`).
8. **FAILED and ABANDONED are not final.** A late bank transfer or a retry with another card on the same reference still moves the order to PAID.
9. **Paid but out of stock:** the order stays PAID and is flagged for review. A payment is never thrown away.
10. **Reversal after PAID:** the order is escalated (`needsReview`), not silently downgraded.
11. **The client remembers in-flight payments.** The reference is saved to `localStorage` before Paystack opens. A banner on every page says "we're confirming your payment, don't pay again", and the status page can **resume the same Paystack session** instead of starting a new charge.
12. **Popup fallback:** if Paystack's inline script can't load (bad network or an ad-blocker), the customer is redirected to Paystack's hosted page, which returns to `/checkout/status`.

Order statuses: `PENDING → PAID | FAILED | ABANDONED | AMOUNT_MISMATCH | REFUNDED`. The final statuses (`PAID`, `AMOUNT_MISMATCH`, `REFUNDED`) are never changed automatically.

## Security

- **Strict CSP:** per-request nonce plus `strict-dynamic` (`src/middleware.ts`), `frame-ancestors 'none'`, and only Paystack hosts allowed for frames and connections. All pages render dynamically so the nonce applies.
- **Response headers:** HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and no `X-Powered-By`.
- **CSRF:** JSON POST endpoints require a same-origin `Origin` header and `application/json`.
- **Input handling:**
  - Every input is validated with Zod on the server; the client checks are only for UX.
  - Request bodies are capped in size.
  - Honeypots catch form spam.
- **Rate limiting** on every public endpoint (`lib/rate-limit.ts`). This is in-memory, so **swap it for Redis/Upstash on multi-instance hosting**.
- **Secrets:**
  - Secrets live only on the server (`server-only` imports). The Paystack secret key never reaches the browser, and no public key is needed.
  - The cron endpoint uses a bearer secret with a timing-safe comparison.
- **Data exposure:**
  - Payment references are unguessable.
  - The public status endpoint returns a masked email and no other personal data.
  - Structured logs redact secrets and tokens.

## Deploy checklist

1. Create a Postgres database (Neon, Supabase or Vercel → Storage) and set `DATABASE_URL` to its **direct** connection string. Migrations run automatically on every build. Seed it once with `npm run db:seed` from a machine whose `.env` points at it.
2. Set `APP_URL`, `PAYSTACK_SECRET_KEY` (live), `CRON_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ADMIN_TO` and optionally `PAYSTACK_WEBHOOK_IPS` (see `.env.example`).
3. In the Paystack dashboard, set the webhook URL to `https://<domain>/api/payments/webhook`.
4. Schedule `/api/payments/reconcile` (needs `Authorization: Bearer $CRON_SECRET`):
   - **Every 10 min:** `.github/workflows/reconcile-payments.yml` (GitHub Actions). Add repo secrets `APP_URL` and `CRON_SECRET`.
   - **Daily backstop:** `vercel.json`. Vercel Hobby allows only daily crons; on Vercel Pro you can set it to `*/10 * * * *` and drop the workflow.
5. Replace the in-memory rate limiter with Redis/Upstash if you run more than one instance.
6. Before going live, run a few `sk_test_` payments, including closing the popup mid-payment and turning off Wi-Fi after paying.

## Content the client must supply (search the code for `TODO(client)`)

- Real phone, WhatsApp, email and address (`src/content/site.ts`)
- **Real testimonials.** The current ones are placeholders and must be replaced before launch.
- Real stats (`stats`), delivery rates (`lib/pricing.ts`), delivery timelines in the FAQ, and the legal pages
- Official logo SVG (`components/layout/Logo.tsx`) and live inventory (an admin dashboard is the natural next step)

## Not included yet (recommended next steps)

- Automatic distance-based delivery pricing (Google Maps). A proposal for the client has been prepared separately.
- Customer accounts (log in / sign up) and order history
- Two-factor authentication for admins (TOTP)
- Error monitoring (Sentry) and uptime alerts on the reconcile cron
- Cleanup job for Cloudinary uploads that were never saved (an admin uploads, then abandons the form)
# fluffy-octo-waffle
# fluffy-octo-waffle
