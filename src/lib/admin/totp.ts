import "server-only";

import { verifySync } from "otplib";

/**
 * Verify a TOTP code against the shared admin secret.
 *
 * Operational guidance — rotating `ADMIN_TOTP_SECRET` is a multi-step
 * procedure (Vercel update, panic-revoke of existing sessions, second-admin
 * verification). See {@link ../../../docs/admin/totp-rotation.md} for the
 * full runbook. A Sentry alert on `admin.totp.verified` dropping to zero
 * over 15 minutes is the catch for a rotation that didn't propagate; see
 * {@link ../../../docs/sentry/alerts.md}.
 */
export function verifyTotp(secret: string | undefined, token: string | undefined): boolean {
	if (!secret || !token?.trim()) return false;
	try {
		const result = verifySync({
			secret,
			token: token.trim(),
			epochTolerance: 1,
		});
		return result.valid === true;
	} catch {
		return false;
	}
}
