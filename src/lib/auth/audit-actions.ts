/**
 * Auth-related audit-log action constants. Kept in sync with how every
 * `writeAuthAudit` call site labels its row so dashboards / SIEM filters
 * can pivot on a stable enum instead of free-form strings.
 */
export const AUTH_ACTIONS = {
	LOGIN_SUCCEEDED: "auth.login.succeeded",
	LOGIN_FAILED: "auth.login.failed",
	SIGNUP_COMPLETED: "auth.signup.completed",
	PASSWORD_RECOVERY_COMPLETED: "auth.password.recovery.completed",
} as const;

export type AuthActionName = (typeof AUTH_ACTIONS)[keyof typeof AUTH_ACTIONS];

/**
 * Coarse-grained failure reasons attached to LOGIN_FAILED audit rows and to
 * the `reason` tag of the Sentry breadcrumb in `loginAction`. Keep the set
 * small so dashboard counters stay readable; route detail to Sentry extras.
 */
export type LoginFailureReason =
	| "invalid_credentials"
	| "unverified_email"
	| "rate_limited"
	| "other";

const RATE_LIMIT_PATTERNS = [/rate limit/i, /too many requests/i, /retry/i];

export function classifyLoginFailure(message: string | null | undefined): LoginFailureReason {
	if (!message) return "other";
	const m = message.toLowerCase();
	if (m.includes("invalid login credentials") || m.includes("invalid email or password")) {
		return "invalid_credentials";
	}
	if (m.includes("email not confirmed") || m.includes("not verified")) {
		return "unverified_email";
	}
	if (RATE_LIMIT_PATTERNS.some((p) => p.test(message))) {
		return "rate_limited";
	}
	return "other";
}
