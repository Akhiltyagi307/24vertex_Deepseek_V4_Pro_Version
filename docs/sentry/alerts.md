# Sentry alert rules

This page documents the Sentry alert rules that are part of the security and
operational posture. Configure them in Sentry → Alerts → Create Alert Rule
unless noted otherwise.

## Admin TOTP verification dropouts

**Why:** A rotated `ADMIN_TOTP_SECRET` that didn't propagate (Vercel save
forgotten, deploy stuck, peer Node process holding the old value) silently
locks admins out. The shape on the wire is "every TOTP verification fails";
the shape in Sentry is `admin.totp.verified` falling to zero.

**Configuration:**

| Field | Value |
|---|---|
| Type | Metric Alert |
| Metric | `admin.totp.verified` (custom message captured in `src/lib/admin/totp.ts`) |
| Filter | `environment:production` |
| Window | 15 minutes |
| Condition | count == 0 |
| Cooldown | 30 minutes |
| Action | PagerDuty `admin-security` or Slack `#oncall-security` |

**Runbook:** Open `docs/admin/totp-rotation.md` step 2 — confirm Vercel saved
the new value and the redeploy completed.

## Razorpay webhook signature failures (sampled)

Already configured in code via `maybeCaptureSignatureFailure` in
`app/api/billing/webhook/route.ts` (1 capture per minute). Add a Sentry
alert on the resulting message `billing.webhook.signature_invalid`:

| Field | Value |
|---|---|
| Type | Issue Alert |
| Condition | Event count > 5 over 5 minutes |
| Action | Slack `#oncall-billing` |

## Service-role key in client bundle

`scripts/ci-verify-no-service-role-in-next-static.mjs` runs in CI and exits
non-zero on detection. No Sentry alert needed because the build fails first.

## Email-webhook dedup hit rate

Capture `email.webhook.deduped` events (not yet wired). A non-trivial dedup
rate is normal and expected (Resend retries). A sudden spike to >50% would
suggest Resend's retry policy changed or our event-id derivation is wrong.

| Field | Value |
|---|---|
| Type | Metric Alert (optional) |
| Window | 1 hour |
| Condition | (deduped / total) > 0.5 |
| Action | Slack `#oncall-platform` |

## How to add a new alert

1. Add a tag-rich `Sentry.captureMessage` (or `addBreadcrumb`) at the
   detection point in code.
2. Add the rule to this doc (so the runbook trail exists).
3. Configure in Sentry UI — choose Issue Alert for "did X happen at all" or
   Metric Alert for "is the rate of X normal".
4. Default to Slack first, PagerDuty for genuinely page-worthy.
