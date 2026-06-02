import "server-only";

import { rlConsume } from "@/lib/ratelimit/consume";
import { shouldDenyOnDegraded } from "@/lib/ratelimit/fail-policy";

export const TEACHER_PORTAL_ACTION_LIMIT = 120;
export const TEACHER_PORTAL_ACTION_WINDOW_SEC = 60;

export type TeacherPortalActionRateLimitResult =
	| { ok: true }
	| { ok: false; message: string };

export async function consumeTeacherPortalDataActionRateLimit(
	teacherUserId: string,
): Promise<TeacherPortalActionRateLimitResult> {
	const result = await rlConsume({
		key: `teacher-portal-actions:user:${teacherUserId}`,
		limit: TEACHER_PORTAL_ACTION_LIMIT,
		windowSec: TEACHER_PORTAL_ACTION_WINDOW_SEC,
	});

	// Fail closed in prod when the limiter is degraded (see fail-policy).
	if (shouldDenyOnDegraded(result)) {
		return { ok: false, message: "Service is busy right now. Try again in a moment." };
	}

	if (result.allowed) {
		return { ok: true };
	}

	return { ok: false, message: "Too many teacher portal requests. Slow down and try again shortly." };
}

