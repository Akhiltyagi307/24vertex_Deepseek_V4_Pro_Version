import "server-only";

import { rlConsume } from "@/lib/ratelimit/consume";

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

	if (result.allowed) {
		return { ok: true };
	}

	return { ok: false, message: "Too many teacher portal requests. Slow down and try again shortly." };
}

