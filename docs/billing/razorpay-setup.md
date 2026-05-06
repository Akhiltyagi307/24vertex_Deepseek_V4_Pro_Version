# Razorpay setup runbook

Everything that has to be configured **inside Razorpay's dashboard** for the EduAI billing system to work end-to-end. Order matters — later steps depend on earlier ones.

Companion docs:

- [docs/billing/followups.md](followups.md) — deferred work + ops notes
- [src/lib/billing/razorpay-webhook-processor.ts](../../src/lib/billing/razorpay-webhook-processor.ts) — the 12 webhook event handlers
- `scripts/seed-razorpay-plans.ts` — creates the canonical plans at Razorpay

> **Each Razorpay account has separate Test and Live modes.** Everything below has to be done **twice** — once with test keys (paired to the dev Supabase project `ezxmjkvhrlqeimhnfvfd`), once with live keys (paired to the prod Supabase project `suwakggcbxmmvqzeudmq`). Plan IDs, customer IDs, offer IDs, webhook secrets, etc. are NOT shared between modes.

---

## TL;DR — minimum viable config

- [ ] Activate Subscriptions product (Settings → Configuration → Subscriptions)
- [ ] Generate API key pair → set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- [ ] Add webhook → `${APP_URL}/api/billing/webhook` → store secret in `RAZORPAY_WEBHOOK_SECRET`
- [ ] Enable all 15 webhook events listed in §4
- [ ] `pnpm tsx scripts/seed-razorpay-plans.ts` → paste plan IDs into `plans.razorpay_plan_id`
- [ ] Set `app_base_url` + `cron_secret` in the Supabase vault on both projects

---

## 1. Account-level prerequisites (one-time)

- [ ] **KYC complete** in Razorpay → enables Live mode. Test mode works without KYC.
- [ ] **Subscriptions product enabled.** Dashboard → Settings → Configuration → Subscriptions → toggle on.
  - Without this the Subscriptions API returns 4xx and `createSubscription` calls die.
- [ ] **Business GSTIN added** (optional but recommended for Indian customers). Dashboard → Account & Settings → Business Profile → GSTIN.

---

## 2. API keys (per environment)

Generate two separate sets — one for Test mode, one for Live mode.

**Dashboard → Account & Settings → API Keys → Generate Test/Live Key.**

You receive a `key_id` (`rzp_test_…` or `rzp_live_…`) and a `key_secret`. The secret is shown **once** — copy immediately.

| Razorpay value | Env var | Where it goes | Notes |
|---|---|---|---|
| `key_id` | `RAZORPAY_KEY_ID` | server (Vercel + local `.env`) | Used by SDK calls |
| `key_secret` | `RAZORPAY_KEY_SECRET` | server only | Never commit, never expose to client |
| `key_id` (same value) | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client + server | Lets the browser open Razorpay Checkout |

Configure dev Vercel + local with **test** keys; configure prod Vercel with **live** keys.

---

## 3. Webhook endpoint (per environment)

**Dashboard → Settings → Webhooks → Add New Webhook.**

| Field | Value |
|---|---|
| **Webhook URL** | `https://YOUR_APP_DOMAIN/api/billing/webhook` |
| **Secret** | Generate locally with `openssl rand -hex 32`. Paste into Razorpay AND store same value in `RAZORPAY_WEBHOOK_SECRET`. |
| **Alert email** | An address that's actually monitored. Razorpay emails this when the webhook auto-disables after 24h of failures. |
| **Active events** | See §4 below — all 15 must be ticked. |

Razorpay tests the URL responds before saving. The route must be deployed and reachable first.

### Secret rotation (when needed)

1. Generate a new secret.
2. Set it as the new `RAZORPAY_WEBHOOK_SECRET` on Vercel.
3. Move the old value into `RAZORPAY_WEBHOOK_SECRET_EXTRA` (comma-separated if multiple). Our verifier accepts any in the list.
4. Update Razorpay's webhook config to the new secret.
5. After a few hours of clean delivery, remove the old secret from `RAZORPAY_WEBHOOK_SECRET_EXTRA`.

---

## 4. Required webhook events (enable ALL 15)

Tick exactly these in the webhook config's **Active Events** section. Anything missing means the corresponding handler silently never fires; reconciliation will eventually catch the drift but you lose real-time accuracy.

### Subscription lifecycle (10)
- [ ] `subscription.authenticated`
- [ ] `subscription.activated`
- [ ] `subscription.charged`
- [ ] `subscription.completed`
- [ ] `subscription.cancelled`
- [ ] `subscription.halted`
- [ ] `subscription.pending`
- [ ] `subscription.updated` — needed for plan changes (W4.1)
- [ ] `subscription.paused` — needed for pause flow (W4.2)
- [ ] `subscription.resumed` — needed for resume flow (W4.2)

### Payment lifecycle (2)
- [ ] `payment.failed`
- [ ] `invoice.paid`

### Refund lifecycle (3) — all required for W3.2
- [ ] `refund.created` — informational, fires when admin initiates
- [ ] `refund.processed` — triggers coupon-redemption rollback + payments-row update
- [ ] `refund.failed` — escalates to `billing_action_failures` for admin investigation

### Verification

From Razorpay's webhook detail page, click **Test Webhook** for each event type. After each:

```sql
SELECT event_type, processed_at, error
FROM billing_events
WHERE razorpay_event_id LIKE '%-test-%'
ORDER BY created_at DESC LIMIT 1;
```

You should see one row per test event with `processed_at` populated and `error` null.

---

## 5. Plans (one-time per environment)

Plans must exist at Razorpay before subscriptions can use them. Two paths:

### Option A — seed script (recommended)

```bash
pnpm tsx scripts/seed-razorpay-plans.ts
```

Creates `pro_monthly` (₹1,000/month) and `pro_annual` (₹10,000/year) at Razorpay using the Plans API. Prints the resulting `plan_id` for each.

### Option B — manually in dashboard

**Dashboard → Subscriptions → Plans → Create Plan.**

| Field | Pro Monthly | Pro Annual |
|---|---|---|
| Period | `monthly` | `yearly` |
| Interval | `1` | `1` |
| Item amount | `100000` paise | `1000000` paise |
| Currency | INR | INR |
| Item name | "Pro Monthly" | "Pro Annual" |

### After creation (either path)

Paste each `plan_id` into Supabase. **Apply to both projects** with their respective Razorpay plan IDs (dev gets test plan IDs, prod gets live plan IDs):

```sql
UPDATE plans SET razorpay_plan_id = 'plan_XXXXXXXXX' WHERE code = 'pro_monthly';
UPDATE plans SET razorpay_plan_id = 'plan_YYYYYYYYY' WHERE code = 'pro_annual';
```

Verify:

```sql
SELECT code, razorpay_plan_id, price_paise, interval
FROM plans
WHERE razorpay_plan_id IS NOT NULL;
```

---

## 6. Subscription offers (zero manual work)

Offers (Razorpay-side discount objects) are created **on demand by EduAI's admin panel**, not in Razorpay's dashboard. Workflow:

1. Admin creates a `checkout_discount` coupon in `/admin/billing/coupons`.
2. Admin clicks **Sync Razorpay offers** on the coupon detail page.
3. EduAI calls Razorpay's `POST /v1/offers` for each eligible plan.
4. Returned offer IDs are stored in `coupons.razorpay_offers_by_plan` JSONB.

**Do NOT create offers manually** unless you have a specific reason. If you ever do, paste their IDs directly into the JSONB instead of clicking Sync.

The weekly cron `billing-validate-offers-weekly` (Sundays 04:00 UTC) checks every linked offer is still active at Razorpay; if Razorpay deleted/disabled one, the corresponding coupon is auto-deactivated and a row is written to `billing_action_failures`.

---

## 7. Mandate / payment method support

Subscriptions need a recurring-payment mandate.

**Dashboard → Settings → Configuration → Recurring Payments.**

Enable:

- [ ] **UPI Autopay** — default for Indian customers; works on all major banks
- [ ] **Card mandates / Recurring Cards** — may require additional KYC
- [ ] **Net-banking e-mandates** — limited bank list; enable if your audience uses them

UPI Autopay alone covers most Indian student/parent customers; the others are belt-and-suspenders.

---

## 8. Brand & checkout customization (optional but recommended)

**Dashboard → Account & Settings → Branding.**

- [ ] **Brand logo** (PNG, ~256×256). Shown in the checkout modal header.
- [ ] **Brand color** — set to `#059669` (emerald) to match what we pass in [razorpay-checkout.tsx](../../src/components/student/subscription/razorpay-checkout.tsx).
- [ ] **Support email + phone** — shown to customers in payment-failure copy.

**Dashboard → Settings → Checkout** (if available on your account tier):

- [ ] **Customer notification email/SMS** — keep enabled. Razorpay sends payment receipts and failure notifications; our system layers EduAI-branded emails on top.

---

## 9. GST / tax (Indian businesses)

If your company has a GSTIN:

**Dashboard → Account & Settings → Tax Settings → Add GSTIN.**

Razorpay then generates GST-compliant invoices on every subscription charge. The hosted invoice URL we receive in `subscription.charged` webhook (and store in `payments.invoice_short_url`) includes the GST breakdown.

> **Important**: our pricing math (`plans.price_paise`) does NOT add GST on top. Razorpay either includes GST in or excludes from the plan amount based on your account-level tax config. **Verify with a test charge before launching live.**

---

## 10. Webhook & API monitoring

**Dashboard → Settings → Webhooks → [your webhook] → Recent Deliveries.**

- Razorpay logs every delivery attempt for 30 days.
- When debugging a missing event in our `billing_events` table, this is the first place to look — confirms whether Razorpay even tried to deliver vs. our endpoint silently dropping it.

### Auto-disable rule

If your endpoint returns non-2xx for **24 consecutive hours**, Razorpay disables the webhook and emails the alert address. There's no API to re-enable — you must click **Enable** in the dashboard manually.

When this happens, the [reconciliation cron](../../app/api/internal/billing/reconcile/route.ts) will catch the drift and write rows to `billing_reconciliation_drift`. Re-enable the webhook, then optionally run reconciliation manually:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_APP_DOMAIN/api/internal/billing/reconcile
```

---

## 11. Test mode workflow (use this BEFORE going live)

Test mode is your sandbox.

### Test cards / UPI handles

Razorpay provides test instruments — see [their docs](https://razorpay.com/docs/payments/payments/test-mode/test-cards/) for the full list. Common ones:

| Method | Value | Result |
|---|---|---|
| Card | `4111 1111 1111 1111`, any future expiry, any CVV | Success |
| Card | `5104 0600 0000 0008`, any future expiry, any CVV | Success (Mastercard) |
| UPI | `success@razorpay` | Success |
| UPI | `failure@razorpay` | Failure |

### What's separate between test and live

- API keys
- Customers
- Plans (test plan IDs ≠ live plan IDs — the seed script creates separate ones)
- Subscriptions
- Offers
- Webhooks (separate webhook endpoints, separate secrets)
- Payments
- Refunds

**Nothing carries over** when you flip to live mode. Treat it as a fresh tenant.

---

## 12. Going live (production cutover)

In order:

1. [ ] Generate live API keys (§2).
2. [ ] Set live keys as env vars on the production Vercel deployment.
3. [ ] Run plan-seeding script targeting live mode (uses live key); copy live plan IDs into the prod Supabase `plans` table.
4. [ ] Add a live-mode webhook in Razorpay (separate from the test-mode one); set `RAZORPAY_WEBHOOK_SECRET` to its secret on prod Vercel.
5. [ ] Enable all 15 events on the live webhook (§4).
6. [ ] Confirm vault secrets `app_base_url` and `cron_secret` exist on the prod Supabase project (§13).
7. [ ] **Smoke-test with a real ₹1 charge** before announcing — go through the full subscribe flow end-to-end and watch for:
   - `payments` row created
   - `subscriptions.status` = `active`
   - `billing_events` populated with `subscription.charged`
   - Receipt email delivered
8. [ ] If smoke-test passes, you're live.

---

## 13. Env-var checklist

### Per Vercel deployment

| Env var | Source | Required |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay → API Keys | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay → API Keys | ✅ |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same value as `RAZORPAY_KEY_ID` | ✅ |
| `RAZORPAY_WEBHOOK_SECRET` | You generate; paste into Razorpay → Webhooks | ✅ |
| `RAZORPAY_WEBHOOK_SECRET_EXTRA` | Comma-separated old secrets during rotation | optional |
| `CRON_SECRET` | You generate; matches Supabase vault `cron_secret` | ✅ for crons |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | ✅ for CSRF guard |

### In the Supabase vault (both projects)

```sql
-- Run on each project
INSERT INTO vault.secrets (name, secret) VALUES
  ('app_base_url', 'https://YOUR_APP_DOMAIN'),  -- no trailing slash
  ('cron_secret', 'matches CRON_SECRET env var on Vercel')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

Without these, the 7 billing pg_cron jobs run but their `pg_net` HTTP POSTs return 401.

---

## 14. Final verification

After completing setup, run all of these. They should all succeed cleanly.

```sql
-- 1. Plans seeded
SELECT code, razorpay_plan_id IS NOT NULL AS seeded
FROM plans WHERE code LIKE 'pro_%';

-- 2. Cron jobs scheduled (expect 6 billing-* rows)
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'billing%';

-- 3. Vault secrets exist (expect 2 rows)
SELECT name FROM vault.secrets
WHERE name IN ('app_base_url', 'cron_secret');

-- 4. RLS deny on internal tables (expect 0 — anon can't read)
SET ROLE anon;
SELECT count(*) FROM billing_events;       -- should error / return 0
SELECT count(*) FROM billing_action_failures;
RESET ROLE;
```

```bash
# 5. Webhook endpoint signs correctly
curl -X POST https://YOUR_APP_DOMAIN/api/billing/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: bogus" \
  -d '{"event":"test"}'
# Expected: HTTP 400, body { "ok": false, "message": "Bad signature." }

# 6. Reconciliation cron route is reachable (auth-gated)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_APP_DOMAIN/api/internal/billing/reconcile
# Expected: HTTP 200, JSON body with summary counts

# 7. Without auth, internal cron route refuses
curl -X POST https://YOUR_APP_DOMAIN/api/internal/billing/reconcile
# Expected: HTTP 401
```

Then in Razorpay's dashboard, click **Test webhook** for `subscription.activated`. Confirm:

```sql
SELECT event_type, processed_at, error
FROM billing_events
ORDER BY created_at DESC LIMIT 1;
```

Should be `subscription.activated`, `processed_at` populated, `error` null.

---

## 15. Common operational issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `createSubscription` returns "Plan is not linked to Razorpay yet" | `plans.razorpay_plan_id` is NULL | Run seed script (§5) and update column |
| Webhook hits our endpoint but `billing_events` stays empty | Bad signature — wrong `RAZORPAY_WEBHOOK_SECRET` | Verify the env var matches Razorpay dashboard secret exactly (no trailing whitespace) |
| Plan-change request returns 404 from Razorpay | Subscriptions API not enabled on account | Re-check §1 — Settings → Configuration → Subscriptions |
| New webhook events aren't processing | Events not enabled on the webhook | Edit webhook in dashboard, tick all 15 events from §4 |
| Cron jobs run but actions don't happen | Vault secrets missing or `cron_secret` mismatch | Re-check §13 — both `app_base_url` and `cron_secret` must exist in `vault.secrets` |
| Webhook auto-disabled by Razorpay | Endpoint returned non-2xx for 24h | Re-enable in dashboard manually + run reconciliation cron to backfill |
| Coupon valid in DB but rejected at checkout | `razorpay_offers_by_plan` empty | Admin → coupon detail → click "Sync Razorpay offers" |
| Test charges work, live charges fail | Wrong key set on prod Vercel | Verify `rzp_live_*` (not `rzp_test_*`) keys are set in production env |

---

## 16. Reference: webhook event → handler map

For debugging, the table below shows which handler fires for each event. All handlers live in [src/lib/billing/razorpay-webhook-processor.ts](../../src/lib/billing/razorpay-webhook-processor.ts).

| Razorpay event | Handler | Local effect |
|---|---|---|
| `subscription.authenticated` | `handleSubscriptionMandateAuthenticated` | Analytics only |
| `subscription.activated` | `handleSubscriptionActivated` | status→active, grant quota, send activation email, record coupon |
| `subscription.charged` | `handleSubscriptionCharged` | status→active, insert payment, send receipt |
| `subscription.updated` | `handleSubscriptionUpdated` | flip plan_code + period bounds (plan-change confirmation) |
| `subscription.paused` | `handleSubscriptionPaused` | mirror local status |
| `subscription.resumed` | `handleSubscriptionResumed` | mirror local status |
| `subscription.completed` | `handleSubscriptionCompleted` | status→expired (terminal) |
| `subscription.cancelled` | `handleSubscriptionCancelled` | status→cancelled (terminal) |
| `subscription.halted` | `handleSubscriptionHaltedOrPending` | status→past_due |
| `subscription.pending` | `handleSubscriptionHaltedOrPending` | status→grace |
| `payment.failed` | `handlePaymentFailed` | status→grace, send dunning day-0 email |
| `invoice.paid` | `handleInvoicePaid` | backstop payment-row insertion |
| `refund.created` | `handleRefundEvent` | analytics only |
| `refund.processed` | `handleRefundEvent` | mark payment refunded + roll back coupon redemption |
| `refund.failed` | `handleRefundEvent` | write to billing_action_failures + Sentry alert |
