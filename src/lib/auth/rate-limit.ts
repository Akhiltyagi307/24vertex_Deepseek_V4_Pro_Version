import "server-only";

import { createHash } from "node:crypto";

import { rlConsume, type RlConsumeResult } from "@/lib/ratelimit/consume";
import { shouldDenyOnDegraded } from "@/lib/ratelimit/fail-policy";

/**
 * App-level rate limiting for the Supabase user-auth surfaces (login, signup,
 * password-reset). Admin login has its own IP-lockout and parent-linking has
 * its own limiter; these actions previously relied solely on Supabase Auth's
 * coarse project-wide limits. Mirrors `@/lib/parent/rate-limit` and uses the
 * shared fail-closed-in-prod policy so a rate-limit DB blip can't open the
 * door to password brute-force / reset-email flooding.
 *
 * IMPORTANT (shared-IP safety): students at a school sit behind one NAT IP, so
 * the primary bucket for login/reset is the *account* (email), with only a
 * generous per-IP ceiling as a secondary credential-stuffing guard. A single
 * student's brute-force is throttled without locking out their classmates.
 */

export const authLoginIpKey = (ip: string): string => `auth-login:ip:${ip}`;
export const authLoginEmailKey = (email: string): string => `auth-login:email:${hashEmail(email)}`;
export const authSignupIpKey = (ip: string): string => `auth-signup:ip:${ip}`;
export const authResetIpKey = (ip: string): string => `auth-reset:ip:${ip}`;
export const authResetEmailKey = (email: string): string => `auth-reset:email:${hashEmail(email)}`;

// Per-account login attempts (the brute-force defense).
export const AUTH_LOGIN_EMAIL_LIMIT = 10;
export const AUTH_LOGIN_EMAIL_WINDOW_SEC = 15 * 60;
// Generous per-IP ceiling so a shared school NAT isn't locked out, while still
// bounding one IP credential-stuffing across many accounts.
export const AUTH_LOGIN_IP_LIMIT = 60;
export const AUTH_LOGIN_IP_WINDOW_SEC = 15 * 60;

// Signup server actions complete a profile / call register RPCs for an
// already-authenticated session; generous per-IP guard against RPC hammering
// (kept high so bulk classroom onboarding from one IP isn't blocked).
export const AUTH_SIGNUP_IP_LIMIT = 40;
export const AUTH_SIGNUP_IP_WINDOW_SEC = 60 * 60;

// Reset is the most abusable (inbox flooding + enumeration): tight per-email,
// looser per-IP.
export const AUTH_RESET_EMAIL_LIMIT = 5;
export const AUTH_RESET_EMAIL_WINDOW_SEC = 60 * 60;
export const AUTH_RESET_IP_LIMIT = 20;
export const AUTH_RESET_IP_WINDOW_SEC = 60 * 60;

export type AuthRateLimitOutcome =
	| { ok: true }
	| { ok: false; result: RlConsumeResult; limit: number };

/** SHA-256 of the normalized email so we never key a bucket on raw PII. */
function hashEmail(email: string): string {
	return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

async function consume(key: string, limit: number, windowSec: number): Promise<AuthRateLimitOutcome> {
	const result = await rlConsume({ key, limit, windowSec });
	// Fail closed in prod when the limiter is degraded so a DB blip can't open
	// these auth endpoints to unbounded attempts.
	if (shouldDenyOnDegraded(result)) {
		return { ok: false, result, limit };
	}
	return result.allowed ? { ok: true } : { ok: false, result, limit };
}

/**
 * Login throttle: per-account first (the real brute-force defense), then a
 * generous per-IP ceiling. Denial of either blocks the attempt.
 */
export async function consumeAuthLogin(ip: string | null, email: string): Promise<AuthRateLimitOutcome> {
	const byEmail = await consume(authLoginEmailKey(email), AUTH_LOGIN_EMAIL_LIMIT, AUTH_LOGIN_EMAIL_WINDOW_SEC);
	if (!byEmail.ok) return byEmail;
	return consume(authLoginIpKey(ip ?? "unknown"), AUTH_LOGIN_IP_LIMIT, AUTH_LOGIN_IP_WINDOW_SEC);
}

export function consumeAuthSignup(ip: string | null): Promise<AuthRateLimitOutcome> {
	return consume(authSignupIpKey(ip ?? "unknown"), AUTH_SIGNUP_IP_LIMIT, AUTH_SIGNUP_IP_WINDOW_SEC);
}

/**
 * Password reset is throttled per-email AND per-IP; denial of either blocks the
 * attempt (an attacker can rotate one dimension but not both).
 */
export async function consumeAuthPasswordReset(
	ip: string | null,
	email: string,
): Promise<AuthRateLimitOutcome> {
	const byEmail = await consume(authResetEmailKey(email), AUTH_RESET_EMAIL_LIMIT, AUTH_RESET_EMAIL_WINDOW_SEC);
	if (!byEmail.ok) return byEmail;
	return consume(authResetIpKey(ip ?? "unknown"), AUTH_RESET_IP_LIMIT, AUTH_RESET_IP_WINDOW_SEC);
}
