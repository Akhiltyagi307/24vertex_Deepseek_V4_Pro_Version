import "server-only";

import { rlConsume } from "@/lib/ratelimit";

export const FEEDBACK_SUBMIT_LIMIT_N = 10;
export const FEEDBACK_SUBMIT_WINDOW_SECONDS = 3600;

export type FeedbackRateLimitResult =
	| { ok: true; remaining: number; resetAt: Date }
	| { ok: false; resetAt: Date };

export async function consumeFeedbackSubmitRateLimit(userId: string): Promise<FeedbackRateLimitResult> {
	const result = await rlConsume({
		key: `feedback:user:${userId}`,
		limit: FEEDBACK_SUBMIT_LIMIT_N,
		windowSec: FEEDBACK_SUBMIT_WINDOW_SECONDS,
	});
	if (result.allowed) {
		return { ok: true, remaining: result.remaining, resetAt: result.resetAt };
	}
	return { ok: false, resetAt: result.resetAt };
}
