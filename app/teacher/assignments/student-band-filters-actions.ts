"use server";

import { z } from "zod";

import { listTeacherAssignableStudents } from "@/lib/assignments/queries";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import {
	getTeacherStudentPerformanceBandsForSubject,
} from "@/lib/teachers/teacher-class-performance-summary";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";

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

	const user = await getServerUser();
	const profile = await getCachedAppProfileRow();
	if (!user || !profile || profile.role !== "teacher") {
		return { error: "Not signed in as a teacher." };
	}
	if (!profile.is_verified) {
		return { error: "Your account must be verified." };
	}

	const assignable = await listTeacherAssignableStudents(user.id);
	const allowed = new Set(assignable.map((s) => s.id));
	const studentIds = parsed.data.studentIds.filter((id) => allowed.has(id));
	if (studentIds.length === 0) {
		return { bands: {} };
	}

	const map = await getTeacherStudentPerformanceBandsForSubject({
		teacherId: user.id,
		studentIds,
		subjectId: parsed.data.subjectId,
	});

	return { bands: Object.fromEntries(map) };
}
