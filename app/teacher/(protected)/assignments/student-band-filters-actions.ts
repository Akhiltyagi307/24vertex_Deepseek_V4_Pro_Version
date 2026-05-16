"use server";

import { z } from "zod";

import { listTeacherAssignableStudents } from "@/lib/assignments/queries";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import {
	getTeacherStudentPerformanceBandsForSubject,
} from "@/lib/teachers/teacher-class-performance-summary";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";

const payloadSchema = z.object({
	subjectId: z.string().uuid(),
	studentIds: z.array(z.string().uuid()).max(500),
});

export type FetchAssignableStudentBandsResult =
	| { bands: Record<string, TeacherPerformanceBandId | null> }
	| { error: string };

/** Performance band per assignable student for the selected subject (dashboard rules: last 5 graded items, assignments + practice). */
export async function fetchAssignableStudentPerformanceBands(
	raw: unknown,
): Promise<FetchAssignableStudentBandsResult> {
	const parsed = payloadSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.flatten().formErrors[0] ?? "Invalid request." };
	}

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		return { error: session.message };
	}
	const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
	if (!rate.ok) {
		return { error: rate.message };
	}

	const assignable = await listTeacherAssignableStudents(session.user.id);
	const allowed = new Set(assignable.map((s) => s.id));
	const studentIds = parsed.data.studentIds.filter((id) => allowed.has(id));
	if (studentIds.length === 0) {
		return { bands: {} };
	}

	const map = await getTeacherStudentPerformanceBandsForSubject({
		teacherId: session.user.id,
		studentIds,
		subjectId: parsed.data.subjectId,
	});

	return { bands: Object.fromEntries(map) };
}
