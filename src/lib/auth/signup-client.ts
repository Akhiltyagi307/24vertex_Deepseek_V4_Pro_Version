import { z } from "zod";

import { VERTEX24_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { getAppUrl } from "@/lib/env";

/**
 * Single source of truth for the "new + confirm password" client-side gate
 * shared across student / parent / teacher signup and any future password
 * forms that need parity with signup. The server still re-validates via the
 * role-specific Zod schemas in `validations/auth.ts`.
 */
export const passwordPairSchema = z
	.object({
		password: z.string().min(8, "Password must be at least 8 characters."),
		confirmPassword: z.string().min(1, "Confirm your password."),
	})
	.strict()
	.refine((d) => d.password === d.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

/**
 * Runs `passwordPairSchema` and returns a flat result the signup forms can
 * surface in their existing `state.error` slot without re-implementing the
 * "min 8 chars vs mismatch" decision tree in three places.
 */
export function validatePasswordPair(
	password: string,
	confirmPassword: string,
): { ok: true } | { ok: false; error: string } {
	const parsed = passwordPairSchema.safeParse({ password, confirmPassword });
	if (parsed.success) return { ok: true };
	const first =
		Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
		parsed.error.issues[0]?.message ??
		"Check your password fields.";
	return { ok: false, error: first };
}

/**
 * Resolves the absolute URL Supabase should put in the verification email.
 * Falls back to `window.location.origin` only if `getAppUrl()` throws (dev
 * environments without `NEXT_PUBLIC_APP_URL`). Throws if neither is usable
 * so signup fails loudly instead of silently emailing a broken link.
 */
export function resolveEmailRedirectTo(): string {
	try {
		return `${getAppUrl()}/auth/callback`;
	} catch (error) {
		if (typeof window !== "undefined" && window.location.origin) {
			return `${window.location.origin}/auth/callback`;
		}
		throw error;
	}
}

type PendingRegistrationRole = "student" | "parent" | "teacher";

/**
 * Builds the `options.data` payload for `supabase.auth.signUp` that the
 * `/auth/callback` route later parses via `consumePendingRegistration`. The
 * envelope shape (version + role + payload) must stay aligned with
 * `parsePendingEnvelopeFromUser` in `src/lib/auth/pending-registration.ts`.
 */
export function buildPendingRegistrationMeta<TPayload>(
	role: PendingRegistrationRole,
	payload: TPayload,
): Record<string, string> {
	return {
		[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
			version: 1,
			role,
			payload,
		}),
	};
}
