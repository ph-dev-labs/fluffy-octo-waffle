# C-ZUCHI — Shipping Container Marketplace

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Motion (Framer Motion) · Embla Carousel · Prisma · Zod · Paystack

## Quick start

```bash
cp .env.example .env          # then fill in PAYSTACK_SECRET_KEY and CRON_SECRET
npm install
npm run db:push               # create tables
npm run db:seed               # sample inventory
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Payment state machine, webhook signature and DB concurrency tests |
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

## Payments: how money is kept safe

**Golden rule:** The browser never decides prices or whether a payment succeeded. Only Paystack's API does, and only when our server asks it.

1. **Server-side pricing.** The cart only stores ids and quantities. `/api/checkout` loads prices from the database, adds the delivery fee (`lib/pricing.ts`), and calculates the total in integer kobo.
2. **Order saved before payment.** The order is written as `PENDING` before Paystack is called. A payment always has an order behind it.
3. **Idempotency key.** Each checkout attempt sends a UUID derived from the payload. If the network drops and the browser retries, it gets the **same** order and access code back, so a customer can't be charged twice. Concurrent duplicate requests are resolved by a unique constraint.
4. **Reference rotation.** If initialising with Paystack times out, the next attempt uses a fresh reference. Only a reference whose access code we returned can ever be paid.
5. **Three independent confirmation paths.** All of them call the same idempotent `applyTransaction`:
   - **Status page polling** (`/checkout/status`): backs off exponentially, pauses while offline, and resumes when the connection or tab comes back.
   - **Webhook** (`/api/payments/webhook`): HMAC-SHA512 signature checked over the raw body in constant time, optional IP allowlist, events de-duplicated, and the result **re-verified with the API** rather than trusting the payload. It returns 5xx on failure so Paystack retries.
   - **Reconciliation cron** (`/api/payments/reconcile`): every 10 minutes it re-verifies any unconfirmed order from the last 72 hours. This catches the case where the customer's phone died **and** the webhook was lost.
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

1. Use Postgres: change `provider` in `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL`, and run `npx prisma migrate deploy`. For case-insensitive search on Postgres, add `mode: "insensitive"` in `lib/catalog.ts`.
2. Set `APP_URL`, `PAYSTACK_SECRET_KEY` (live), `CRON_SECRET` and optionally `PAYSTACK_WEBHOOK_IPS`.
3. In the Paystack dashboard, set the webhook URL to `https://<domain>/api/payments/webhook`.
4. Schedule `/api/payments/reconcile`. `vercel.json` already does this on Vercel; elsewhere, call it with `Authorization: Bearer $CRON_SECRET`.
5. Replace the in-memory rate limiter with Redis/Upstash if you run more than one instance.
6. Before going live, run a few `sk_test_` payments, including closing the popup mid-payment and turning off Wi-Fi after paying.

## Content the client must supply (search the code for `TODO(client)`)

- Real phone, WhatsApp, email and address (`src/content/site.ts`)
- **Real testimonials.** The current ones are placeholders and must be replaced before launch.
- Real stats (`stats`), delivery rates (`lib/pricing.ts`), delivery timelines in the FAQ, and the legal pages
- Official logo SVG (`components/layout/Logo.tsx`) and live inventory (an admin dashboard is the natural next step)

## Not included yet (recommended next steps)

- Admin dashboard: inventory CRUD, orders, and a review queue for `needsReview` orders
- Customer accounts (log in / sign up) and order history
- Transactional email (order receipt, quote and inspection notifications) via Resend or Postmark
- Error monitoring (Sentry) and uptime alerts on the reconcile cron
