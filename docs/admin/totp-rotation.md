# Admin TOTP rotation runbook

`ADMIN_TOTP_SECRET` is the shared secret used by `src/lib/admin/totp.ts` to
verify TOTP codes during admin login and before any writable SQL execution
(see `app/api/admin/system/sql/run/route.ts`). It is operationally critical:
a stale or leaked secret undermines the entire admin authentication chain.

This runbook documents how to rotate it safely. Rotate **immediately** if you
suspect leakage (logs, screen-share, lost device). Otherwise rotate annually
as part of the security review cadence.

---

## Prerequisites

- You can edit Vercel environment variables for both Preview and Production.
- You have access to the admin authenticator app(s) (1Password, Authy, Aegis,
  hardware key) for every admin who will keep access after rotation.
- You have a second admin available to verify the new secret end-to-end
  before retiring the old one (two-person rotation).

## Step 1 — Generate the new secret

```bash
pnpm admin:totp-secret
```

The script (`scripts/admin-totp-secret.mjs`) prints a base32-encoded shared
secret plus a `otpauth://` URI you can render as a QR code. Do not paste the
secret into chat, ticketing, or any tool that retains history. Treat it like
a TLS private key.

## Step 2 — Set `ADMIN_TOTP_SECRET` in Vercel

In the Vercel dashboard → Settings → Environment Variables, **update**
`ADMIN_TOTP_SECRET` for both Preview and Production. Do **not** delete the
previous value — Vercel deploys ahead of time and an in-flight admin login
that snapped a code 30s ago against the old secret should still finish.

After saving, trigger a redeploy (push a no-op commit or use the Vercel UI's
"Redeploy" button) so the new secret is loaded by every Node process.

## Step 3 — Re-enrol admins in their authenticator apps

Each admin imports the new `otpauth://` URI. Test by signing into the admin
console at `/admin/login`. Verify a code is required at the second step. If
TOTP is unconfigured (the secret env var was empty when login-core booted),
re-check Vercel saved the value.

## Step 4 — Boot existing admin sessions

Old admin JWTs are still valid until they expire. To force-logout every
admin session immediately, POST to `/api/admin/panic` (admin-only, requires
current admin auth):

```bash
curl -X POST https://your-app.vercel.app/api/admin/panic \
  -H "Cookie: $(read_admin_cookie)"
```

This bumps `jwt_version` in `admin_runtime_kv`, which `verifyAdminJwt`
checks on every request. All currently-issued tokens become invalid; admins
must sign in again — using the new TOTP secret.

## Step 5 — Confirm with the second admin

The second admin runs through `/admin/login` independently with their
re-enrolled authenticator. If both succeed, rotation is complete.

## Step 6 — File the audit

Open a brief PR or doc entry recording:

- date of rotation
- which admins re-enrolled
- the panic-revoke timestamp
- the reason (scheduled / leakage-suspected / staff change)

This is the artifact SOC2 / ISO 27001 reviewers ask for.

---

## Failure modes

- **Vercel saved the value but old deploy is still serving traffic.** Wait
  for redeploy to finish, then retry.
- **An admin's authenticator was never updated.** They will be unable to
  sign in until they re-import the URI. Have a second admin with valid
  TOTP available as a backup.
- **The new secret was leaked during transit.** Re-rotate immediately — the
  cost is one more redeploy.

## Detection

Add a Sentry alert on the metric `admin.totp.verified` dropping to zero
over a 15-minute window — this is the signal that the rotated secret didn't
make it into Vercel or the deploy is stuck. See `docs/sentry/alerts.md`.

## Why TOTP rather than WebAuthn?

The admin surface today serves a small set of operators (2–4 people) on
personal phones. WebAuthn (security keys / passkeys) is the eventual
target; TOTP is the operationally-cheap transitional choice that still
defeats every credential-stuffing scenario.
