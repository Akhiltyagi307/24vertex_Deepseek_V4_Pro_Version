import "server-only";

import { rlConsume } from "@/lib/ratelimit";
import { shouldDenyOnDegraded } from "@/lib/ratelimit/fail-policy";

export const CONTACT_SUBMIT_LIMIT_N = 5;
export const CONTACT_SUBMIT_WINDOW_SECONDS = 3600;

export type ContactRateLimitResult =
	| { ok: true; remaining: number; resetAt: Date }
	| { ok: false; resetAt: Date };

export async function consumeContactSubmitRateLimit(ip: string): Promise<ContactRateLimitResult> {
	const result = await rlConsume({
		key: `contact:ip:${ip}`,
		limit: CONTACT_SUBMIT_LIMIT_N,
		windowSec: CONTACT_SUBMIT_WINDOW_SECONDS,
	});
	// Fail closed in prod when the limiter is degraded so a DB blip can't turn
	// the contact form into an open spam relay.
	if (shouldDenyOnDegraded(result)) {
		return { ok: false, resetAt: result.resetAt };
	}
	if (result.allowed) {
		return { ok: true, remaining: result.remaining, resetAt: result.resetAt };
	}
	return { ok: false, resetAt: result.resetAt };
}
