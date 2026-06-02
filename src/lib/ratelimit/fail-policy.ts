import "server-only";

import type { RlConsumeResult } from "@/lib/ratelimit/consume";

/**
 * Shared fail policy for rate-limit wrappers. In production/preview we fail
 * CLOSED when the rate-limit circuit is open, so a flaky rate-limit DB can't be
 * exploited to bypass abuse limits (spam, enumeration, brute force). Locally we
 * fail open so dev work isn't blocked by infra hiccups.
 *
 * Mirrors `studentRateLimitFailClosed()` in `@/lib/student/rate-limit`; kept
 * here so non-student wrappers don't depend on the student module.
 */
export function rateLimitFailClosedInProd(): boolean {
	return (
		process.env.VERCEL_ENV === "preview" ||
		process.env.VERCEL_ENV === "production" ||
		process.env.NODE_ENV === "production"
	);
}

/**
 * True when a rate-limit verdict should be treated as DENY because the limiter
 * is degraded: always on sustained flap (`circuit_fail_closed`), and on a
 * transient open circuit when {@link rateLimitFailClosedInProd}. Callers that
 * only checked `result.allowed` previously let everything through during a DB
 * blip — this closes that hole for abuse-sensitive endpoints.
 */
export function shouldDenyOnDegraded(result: Pick<RlConsumeResult, "degraded">): boolean {
	if (result.degraded === "circuit_fail_closed") return true;
	if (result.degraded === "circuit_open" && rateLimitFailClosedInProd()) return true;
	return false;
}
