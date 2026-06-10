import type { Instrumentation } from "next";

/**
 * Next.js instrumentation hook. Wired up to pull in Sentry configuration on
 * both server and edge runtimes. Client-side Sentry is initialized via
 * `sentry.client.config.ts` in the root layout (Next auto-detects when
 * present at the repo root).
 */
function sentryDsnConfigured(): boolean {
	return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * D1: Block production boot if a plaintext `ADMIN_PASSWORD` is configured.
 * Operators must use `ADMIN_PASSWORD_HASH_B64` (bcrypt, cost ≥ 12) in prod.
 * Throwing in `register()` fails the Vercel deployment fast instead of
 * silently shipping plaintext admin creds.
 */
function assertNoPlaintextAdminPasswordInProd(): void {
	if (process.env.NODE_ENV !== "production") return;
	const plain = process.env.ADMIN_PASSWORD?.trim();
	if (plain) {
		throw new Error(
			"ADMIN_PASSWORD must not be set in production. Use ADMIN_PASSWORD_HASH_B64 (bcrypt, cost ≥ 12) instead.",
		);
	}
}

/**
 * C-1: Block production boot unless `SAAS_ENFORCEMENT` is explicitly `"true"`
 * or `"false"`. `isSaasEnforcementEnabled()` treats any non-"true" value
 * (including unset) as OFF, so a deploy that simply forgets the var silently
 * disables ALL billing/quota enforcement (fail-open). Forcing an explicit
 * value here fails the deployment fast instead of shipping free access.
 * Mirrors {@link assertNoPlaintextAdminPasswordInProd}. Kept inline (no
 * `@/lib/env` import) since this runs at the very start of `register()`.
 */
function assertSaasEnforcementConfiguredInProd(): void {
	const isProd =
		process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
	if (!isProd) return;
	const raw = process.env.SAAS_ENFORCEMENT?.trim().toLowerCase();
	if (raw !== "true" && raw !== "false") {
		throw new Error(
			'SAAS_ENFORCEMENT must be explicitly set to "true" or "false" in production. ' +
				"An unset/ambiguous value silently disables all billing and quota enforcement.",
		);
	}
}

/**
 * L1: Require a real admin second factor in production. The admin-login
 * brute-force counter (`isAdminLoginBlocked`) fails OPEN on a rate-limit DB
 * error, justified by "IP allowlist + TOTP" — but both default to off, leaving
 * bcrypt as the only barrier during an outage. Refuse to boot in production
 * unless at least one of `ADMIN_IP_ALLOWLIST` / `ADMIN_TOTP_SECRET` is
 * configured. Mirrors {@link assertNoPlaintextAdminPasswordInProd}.
 */
function assertAdminSecondFactorInProd(): void {
	const isProd =
		process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
	if (!isProd) return;
	const hasAllowlist = Boolean(process.env.ADMIN_IP_ALLOWLIST?.trim());
	const hasTotp = Boolean(process.env.ADMIN_TOTP_SECRET?.trim());
	if (!hasAllowlist && !hasTotp) {
		throw new Error(
			"Production admin auth requires a second factor: set ADMIN_IP_ALLOWLIST and/or ADMIN_TOTP_SECRET. " +
				"The admin-login rate limiter fails open on a DB error, so without one of these bcrypt is the only brute-force barrier.",
		);
	}
}

export async function register() {
	assertNoPlaintextAdminPasswordInProd();
	assertSaasEnforcementConfiguredInProd();
	assertAdminSecondFactorInProd();
	if (!sentryDsnConfigured()) return;
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./sentry.server.config");
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
	if (!sentryDsnConfigured()) return;
	try {
		const Sentry = await import("@sentry/nextjs");
		Sentry.captureRequestError(err, request, context);
	} catch {
		// Sentry not installed / not configured; swallow so the request error
		// still propagates via the framework's default handling.
	}
};
