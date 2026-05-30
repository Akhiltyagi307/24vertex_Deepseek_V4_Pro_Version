# Billing hardening — follow-ups

The W1–W7 hardening pass shipped 14 migrations + ~30 code changes across M1–M5. This doc lists the pieces deliberately deferred so we don't lose them.

## Migrations applied (dev + prod, byte-identical)

M1 (race conditions + security):
- `admin_refund_idempotency_state`
- `subscription_customer_audit`
- `billing_action_failures`
- `billing_redeem_coupon_atomic_v2`

M2 (automation):
- `billing_expiry_pg_cron`
- `coupon_redemptions_refunded_at`
- `billing_reconciliation`

M3 (new features):
- `subscription_plan_change_log`
- `subscription_pause_metadata`
- `billing_dunning_pg_cron`
- `billing_offer_validity_pg_cron`

7 billing pg_cron jobs are now active on both projects (`billing-expire-coupons` daily, `billing-expire-coupon-subs` hourly, `billing-reconcile-daily`, `billing-pause-30day-cancel`, `billing-run-dunning`, `billing-validate-offers-weekly`, plus one pre-existing).

## Done but worth noting

- **`subscription.halted` semantics**: changed from `expired` (terminal) to `past_due` so a later `subscription.charged` recovery transitions cleanly via the state machine. If any monitoring filters on status='expired' for halted-only subs, switch them to `past_due`.
- **Refund idempotency 'orphan' state**: introduced. When the W3.3 reconciliation cron sees a 1h-old `pending` row whose Razorpay refund cannot be confirmed, it marks the row `orphan`. Admin must manually clear before retrying with the same Idempotency-Key — the refund route returns 422 in that case.
- **Coupon redemption is *kept* on refund**, not revoked. `coupon_redemptions.refunded_at` is set, and `coupons.redemptions_count` is decremented. Industry-standard treatment of refunds; if you'd rather punish (revoke) you can flip the policy in `billing_rollback_coupon_redemption_atomic`.

## Deferred — UI / nice-to-haves

These pieces would round out the user experience but weren't required for correctness:

1. **Plan-change UI on student subscription page.** Backend route `POST /api/billing/change-plan` is live; needs a "Change plan" card with a confirm-modal that shows the prorated delta from `quotePlanChange`. Until then, only API integrators can trigger plan changes.
2. **Pause/Resume UI on student subscription page.** Routes `POST /api/billing/pause` and `/api/billing/resume` work; UI should show a "Pause for up to 30 days" toggle on active subs.
3. **Admin override routes for plan-change / pause / resume.** Customer-support flows would benefit from `/api/admin/subscriptions/[id]/change-plan|pause|resume` mirrors. The user routes don't expose admin-acting-on-behalf-of-student.
4. **Admin Action Failures detail page.** The list page exists at `/admin/billing/action-failures` with retry buttons; clicking through to a detail view (full payload, history, manual resolve) is a future addition.
5. **i18n on billing UI strings.** No infra exists; strings stay English. Track separately if the project ever adds next-intl or similar.

## Deferred — code quality / tests

1. **Wrap remaining `void send…Email(...)` analytics calls in try/catch + billing_action_failures.** Today the email layer's own dedup keys give us idempotency, but a true delivery failure (e.g., Resend 5xx) is silently swallowed beyond a Sentry breadcrumb. Worth doing if dunning email reliability ever surfaces a complaint.
2. **Integration tests against a Razorpay sandbox.** The 55 unit tests cover the pure-logic surfaces (state machine, proration, Zod schemas, signature/dedup). End-to-end tests against `BILLING_INTEGRATION_VITEST=1` with real Razorpay test keys would cover the full handshake; deferred because it requires sandbox credentials in CI.
3. **`as unknown as` casts at the SDK *input* boundary** (`razorpay.ts:197, 206, 217`). The SDK's signatures don't match what the server API accepts (boolean vs 0/1, missing pause/resume types). Output casts are all gone (replaced with Zod parses); input casts remain for SDK-shape mismatches and are not unsafe.

## Pre-existing observations not addressed in this pass

- Email delivery isn't queue-backed; `Resend` is called directly from the request path with the `email_log` dedup index providing at-most-once. Acceptable for current volume.
- Razorpay does not document idempotency-key support on refund/order POSTs. We rely on local idempotency tables and the W3.3 cron to detect any drift. Worth re-checking if Razorpay later adds first-class idempotency.
- GST behavior on subscription invoices is left to Razorpay's account-level config; we don't surface tax in our local price math.

## Operational notes

- **Vault secrets `app_base_url` and `cron_secret` must be set on both projects.** All 7 billing cron schedules read these from `vault.decrypted_secrets`. If a fresh project doesn't have them, the cron job runs but the HTTP POST 401s.
- **(M-10) The vault `cron_secret` MUST equal the deployed `CRON_SECRET` env var**, byte-for-byte. The cron job signs `Authorization: Bearer <vault cron_secret>`, but `assertCronRequestAuthorized` (`src/lib/internal/cron-auth.ts`) validates against `process.env.CRON_SECRET` with a timing-safe compare. These are two independent sources — rotating one without the other makes **every** internal cron (dunning, reconcile, coupon-expiry, etc.) silently 401 daily with no app-visible error. When rotating `CRON_SECRET`, update the Supabase vault secret on both projects in the same change. A lightweight admin health-check that pings one internal route with the vault secret and reports a mismatch is a recommended (not-yet-built) follow-up.
- **Reconciliation drift table is admin-internal (RLS deny-all).** Inspect via `/admin/billing/reconciliation`.
- **`billing_action_failures` is the catch-all surface** for non-fatal billing side-effect failures. Open rows = work for an admin.

## Razorpay dashboard — required webhook events

The webhook processor (`src/lib/billing/razorpay-webhook-processor.ts`) handles the following Razorpay events. Confirm each is enabled on the webhook in Razorpay's dashboard (Settings → Webhooks → your endpoint → Active Events). Missing events fail silently — handlers never fire and reconciliation eventually catches drift.

Pre-existing (must already be enabled):
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.completed`
- `subscription.cancelled`
- `subscription.halted`
- `subscription.pending`
- `payment.failed`
- `invoice.paid`

Added in M3 (W4.x) — confirm enabled:
- `subscription.updated` — fires on plan change (W4.1)
- `subscription.paused` — fires when `subscriptions.pause()` lands (W4.2)
- `subscription.resumed` — fires when `subscriptions.resume()` lands (W4.2)
- `refund.created` — informational; analytics only (W3.2)
- `refund.processed` — triggers coupon-redemption rollback + payments table refund-marking (W3.2)
- `refund.failed` — escalated to `billing_action_failures` for admin investigation (W3.2)

Verification: trigger a test event from Razorpay's dashboard for each → confirm a row appears in `public.billing_events` with the expected `event_type`.
