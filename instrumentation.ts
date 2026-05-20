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

export async function register() {
	assertNoPlaintextAdminPasswordInProd();
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
