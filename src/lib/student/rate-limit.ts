import "server-only";

import { rlConsume } from "@/lib/ratelimit";

/**
 * Rate-limit verdict shared by every student-facing route helper.
 *
 * `degraded: "circuit_open"` indicates the rate-limit DB has been flaky and we
 * fell open (the call is allowed). Callers can choose to fail closed (recommended
 * for cost-sensitive paths) by checking this flag against
 * {@link studentRateLimitFailClosed}.
 */
export type StudentRateLimitResult =
	| { ok: true; remaining: number; resetAt: Date; degraded?: "circuit_open" }
	| { ok: false; resetAt: Date; degraded?: "circuit_fail_closed" };

/**
 * Fail-policy: in production / preview we fail closed on circuit-open so a
 * flaky rate-limit DB can't be exploited to bypass limits. Locally we fail
 * open so dev work isn't blocked by infra hiccups.
 */
export function studentRateLimitFailClosed(): boolean {
	return (
		process.env.VERCEL_ENV === "preview" ||
		process.env.VERCEL_ENV === "production" ||
		process.env.NODE_ENV === "production"
	);
}

/**
 * Consume a student-route rate-limit bucket. Bucket keys are namespaced as
 * `student:${bucket}:user:${userId}` so they don't collide with `practice:*`
 * or `admin:*` buckets in the same `rl_consume` table.
 *
 * The caller is expected to have already verified the user is authenticated;
 * `userId` here should be the authenticated student's profile id.
 */
export async function consumeStudentRateLimit(args: {
	userId: string;
	bucket: string;
	limitN: number;
	windowSeconds: number;
}): Promise<StudentRateLimitResult> {
	const result = await rlConsume({
		key: `student:${args.bucket}:user:${args.userId}`,
		limit: args.limitN,
		windowSec: args.windowSeconds,
	});

	if (result.degraded === "circuit_fail_closed") {
		return { ok: false, resetAt: result.resetAt, degraded: "circuit_fail_closed" };
	}

	if (result.degraded === "circuit_open" && studentRateLimitFailClosed()) {
		return { ok: false, resetAt: result.resetAt };
	}

	if (result.allowed) {
		return {
			ok: true,
			remaining: result.remaining,
			resetAt: result.resetAt,
			degraded: result.degraded === "circuit_open" ? "circuit_open" : undefined,
		};
	}

	return { ok: false, resetAt: result.resetAt };
}

/** Buckets sized for the read-heavy notification surface. */
export const STUDENT_NOTIFICATIONS_LIMIT_N = 60;
export const STUDENT_NOTIFICATIONS_WINDOW_SECONDS = 60;

/** Bucket for question flag inserts (storage-bloat protection). */
export const STUDENT_FLAG_QUESTION_LIMIT_N = 30;
export const STUDENT_FLAG_QUESTION_WINDOW_SECONDS = 3600;

/** Practice session-meta updates (heartbeats while a test is in progress). */
export const STUDENT_PRACTICE_SESSION_META_LIMIT_N = 60;
export const STUDENT_PRACTICE_SESSION_META_WINDOW_SECONDS = 60;

/** Practice tab-blur reports — fire several times per question; generous cap. */
export const STUDENT_PRACTICE_TAB_BLUR_LIMIT_N = 120;
export const STUDENT_PRACTICE_TAB_BLUR_WINDOW_SECONDS = 60;

/** Practice answer batch upserts. */
export const STUDENT_PRACTICE_BATCH_UPSERT_LIMIT_N = 30;
export const STUDENT_PRACTICE_BATCH_UPSERT_WINDOW_SECONDS = 60;

/** Practice abandon-submit — should be infrequent; tight cap. */
export const STUDENT_PRACTICE_ABANDON_LIMIT_N = 10;
export const STUDENT_PRACTICE_ABANDON_WINDOW_SECONDS = 60;
