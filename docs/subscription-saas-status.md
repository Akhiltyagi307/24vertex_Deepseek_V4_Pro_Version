# Subscription / SaaS — status

This document tracks what is implemented for Razorpay-based subscriptions, usage limits, and student billing UI, and what remains for launch or polish.

---

## Done (implemented in codebase)

### Data model and database

- **Tables:** `plans`, `subscriptions`, `usage_periods`, `payments`, `coupons`, `coupon_redemptions`, `billing_events`, `free_trial_claims` (see migration `supabase/migrations/20260423000001_saas_billing.sql`, follow-up RLS fix `20260423000002_saas_billing_admin_only_rls.sql`, and **one trial per email/phone** `20260423110000_free_trial_once_per_identity.sql`).
- **Plan catalog:** `free` (14-day trial, 5 tests, 50k **AI output** tokens for doubt chat), `pro_monthly` (₹1,000 / month, 30 tests, 200k / 400k output tokens by grade), `pro_annual` (₹10,000 / year, 12× monthly pool).
- **Trial seeding:** Trigger on `profiles` inserts for students creates a trialing subscription + usage period (or an **expired** stub with no entitlements when the normalized auth email/phone already claimed a trial). Gmail / Googlemail addresses are folded (dots and `+tags` on the local part). Auth users with neither email nor phone still get a trial but are not recorded in `free_trial_claims`. Migration backfills claims for existing students and expires duplicate `trialing` free rows that lost the identity claim.
- **Shared coupon:** Example campaign code `PARENT100` (shared, max redemptions, 30-day Pro Monthly–style window) seeded in migration.
- **Atomic usage:** RPCs `billing_consume_test` and `billing_consume_tokens` for quota consumption (migration `20260423100000_billing_consume_current_period.sql` scopes updates to the **current** usage window only so overlapping trial + paid/coupon rows do not double-count).
- **Drizzle:** Schema mirrors these tables in `src/db/schema/schema.ts`.

### Entitlements and enforcement

- **Module:** `src/lib/billing/entitlements.ts` — `getEntitlements`, `consumeTest`, `consumeTokens`, `canStartDoubtChat`, `rolloverPeriodIfNeeded`.
- **Feature flag:** `SAAS_ENFORCEMENT` — when `false`, meters still compute but actions are not blocked (local dev). When `true`, enforcement applies. `subscriptions.staff_override` bypasses limits for internal testing.
- **Wired into:**
  - `generatePracticeTest` in `app/student/practice/actions.ts` (paywall codes + `paywall: true` on failure),
  - `app/api/student/practice/generate-stream/route.ts`,
  - `app/api/student/doubt-chat/route.ts` (pre-check + **output-only** token usage on stream finish).

### Razorpay integration

- **Server wrapper:** `src/lib/billing/razorpay.ts` (customer, subscription create/cancel/update, plan create helper, webhook HMAC verification).
- **API routes:**
  - `POST /api/billing/create-subscription` — `planCode`, `startMode` (`immediate` | `after_trial` for hybrid trial),
  - `POST /api/billing/cancel` — cancel at period end,
  - `POST /api/billing/webhook` — verified webhooks, idempotent event log, subscription/usage/payment updates, Resend emails on key events.
- **Client checkout:** `src/components/student/subscription/razorpay-checkout.tsx` — loads Razorpay Checkout.js, opens subscription checkout, falls back to hosted `short_url` if needed.
- **Script:** `pnpm razorpay:seed-plans` — creates Razorpay plans and prints SQL to paste into `public.plans.razorpay_plan_id`.

### UI / UX

- **Sidebar:** “Subscription” link in `src/components/student/student-nav-main.tsx` → `/student/subscription`.
- **Subscription page:** `app/student/subscription/page.tsx` — current plan summary, usage, plan cards, coupon redeem, cancel at period end, payment history table.
- **Profile:** Plan summary card at top of settings via `app/student/settings/page.tsx` + `PlanSummaryCard`.
- **Banners:** `SubscriptionBanner` in `app/student/layout.tsx` for trial ending, grace, quota context.
- **Paywall:** `PaywallProvider` in `student-shell.tsx`, dialog in `paywall-dialog.tsx`; practice wizard and doubt chat open it on blocked flows.

### Coupons

- **Server action:** `redeemCoupon` in `app/student/subscription/actions.ts` — validates shared codes, applies Pro window, updates usage; blocks stacking over an active paid Razorpay subscription.

### Email and cron

- **Resend helpers:** `src/lib/email/subscription-notifications.ts` (trial ending, subscription active, payment failed, usage near limit).
- **Webhook:** Sends subscription-active and payment-failed where applicable.
- **Internal cron route:** `GET` / `POST` `app/api/internal/billing/trial-emails/route.ts` — trial reminder emails (deduped via `subscriptions.metadata.trial_emails_sent`), protected by `assertCronRequestAuthorized` → `CRON_SECRET`.

### Analytics and observability

- **Events** in `practice_analytics_events`: e.g. `subscription_started`, `subscription_upgraded`, `subscription_cancelled`, `subscription_payment_failed`, `coupon_redeemed`, `paywall_shown`, `upgrade_clicked` (see `src/lib/practice/analytics.ts`).
- **Sentry:** Webhook handler reports errors; unknown subscription IDs are logged.

### Documentation

- **PDR:** Section **9.5 SAAS SUBSCRIPTIONS** in `docs/EduAI_PDR_v3_0.md` — plan matrix, schema overview, enforcement, Razorpay, admin SQL snippets.
- **Env template:** `.env.example` includes Razorpay and `SAAS_ENFORCEMENT`.

---

## Left to do (launch and follow-up)

### Required before taking real payments

1. **Razorpay Dashboard**
   - Create **live** API keys when going to production; replace test keys.
   - Run `pnpm razorpay:seed-plans` against the **live** account (or equivalent in dashboard), then **persist** returned `plan_id` values into `public.plans.razorpay_plan_id` for `pro_monthly` and `pro_annual`.
   - Register **webhook** URL: `https://<your-domain>/api/billing/webhook` with the same secret as `RAZORPAY_WEBHOOK_SECRET` in the deployed environment.
   - Enable relevant events: subscription lifecycle, `payment.failed`, `invoice.paid` (as already assumed in the webhook handler).

2. **Environment (production)**
   - Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` (id matches key id), `NEXT_PUBLIC_APP_URL` to the **public** HTTPS origin.
   - Set `CRON_SECRET` and configure callers (e.g. Vercel Cron) to send `Authorization: Bearer <CRON_SECRET>` for `/api/internal/billing/trial-emails` and other internal routes.
   - Set `SAAS_ENFORCEMENT=true` when you are ready to **enforce** limits in production (after smoke-testing).

3. **Legal / compliance (Razorpay and trust)**
   - Subscription page links to `/legal/refund` and `/legal/terms` — **those routes are not present in the repo yet** (0 matches under `app/legal` at time of writing). Add real pages or change links to your hosted policy URLs.

### Recommended hardening and product follow-ups

4. **Grace period semantics**  
   PDR mentioned a 5-day grace after payment failure; current behavior sets `grace` on failure but does not auto-flip to `expired` after a fixed window without a scheduled job. Consider a small cron to transition `grace` → `past_due` / `expired` by time.

5. **Plan switch (monthly ↔ annual) on UI**  
   `updateSubscriptionPlan` exists in `razorpay.ts`; the subscription page could expose a dedicated “Switch to annual” (or monthly) that calls a dedicated API route if product wants self-serve proration (currently some CTAs are generic checkout).

6. **Usage warning emails (80% tokens/tests)**  
   `sendUsageNearLimitEmail` exists in `src/lib/email/subscription-notifications.ts` but is **not** automatically scheduled from a cron; wire it to a periodic job that reads `usage_periods` and thresholds, or call from a lightweight check after `consumeTest` / `consumeTokens` (with dedupe to avoid spam).

7. **Admin UI for coupons**  
   Only SQL + PDR runbooks; optional `/admin/coupons` for non-developers to mint codes.

8. **Razorpay hosted invoice URL**  
   Webhook / payment payload should fill `invoice_short_url` in `payments` when Razorpay provides it so the history table always has a “View” link (verify field names in live webhook payload).

9. **Idempotency key for webhooks**  
   Current synthetic `eventId` in the webhook is a best-effort dedupe. If you see duplicate processing, consider persisting Razorpay’s own event `id` from the JSON body when available.

10. **Staging vs production**  
    Use separate Razorpay apps or test vs live keys and separate `CRON_SECRET` per Vercel environment.

---

## Quick reference: env vars

| Variable | Role |
|----------|------|
| `RAZORPAY_KEY_ID` | Server + API |
| `RAZORPAY_KEY_SECRET` | Server only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client Checkout (same id as `RAZORPAY_KEY_ID`) |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC for `/api/billing/webhook` |
| `SAAS_ENFORCEMENT` | `true` = enforce quotas in production |
| `CRON_SECRET` | `Authorization: Bearer` for `/api/internal/*` |

---

*Last updated: subscription implementation per SaaS + Razorpay plan; keep this file in sync when shipping changes.*
