import "server-only";

import { rlConsume, type RlConsumeResult } from "@/lib/ratelimit/consume";

/** Enough for normal class review; tight enough to cap CPU/storage abuse per account. */
const TEACHER_REPORT_PDF_LIMIT = 36;
const TEACHER_REPORT_PDF_WINDOW_SEC = 3600;

export type TeacherReportPdfRateLimitResult =
	| { ok: true }
	| { ok: false; status: 429 | 503; response: Response };

function buildRateLimitHeaders(result: RlConsumeResult, limit: number): HeadersInit {
	const resetEpoch = Math.ceil(result.resetAt.getTime() / 1000);
	const retryAfterSec = Math.max(1, resetEpoch - Math.floor(Date.now() / 1000));
	return {
		"Retry-After": String(retryAfterSec),
		"X-RateLimit-Limit": String(limit),
		"X-RateLimit-Remaining": String(result.remaining),
		"X-RateLimit-Reset": String(resetEpoch),
	};
}

/**
 * Per-verified-teacher cap on PDF GETs (includes denials that occur after this check).
 * Uses the shared `rl_consume` path (same infra as billing/practice limits).
 */
export async function consumeTeacherReportPdfRateLimit(teacherUserId: string): Promise<TeacherReportPdfRateLimitResult> {
	const result = await rlConsume({
		key: `teacher-report-pdf:user:${teacherUserId}`,
		limit: TEACHER_REPORT_PDF_LIMIT,
		windowSec: TEACHER_REPORT_PDF_WINDOW_SEC,
	});

	if (result.allowed) {
		return { ok: true };
	}

	const headers = buildRateLimitHeaders(result, TEACHER_REPORT_PDF_LIMIT);

	if (result.degraded === "circuit_fail_closed") {
		return {
			ok: false,
			status: 503,
			response: new Response("Rate limiting temporarily unavailable. Try again shortly.", {
				status: 503,
				headers,
			}),
		};
	}

	return {
		ok: false,
		status: 429,
		response: new Response("Too many report downloads. Try again later.", {
			status: 429,
			headers,
		}),
	};
}
