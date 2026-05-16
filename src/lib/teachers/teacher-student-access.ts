import "server-only";

import { createClient } from "@/lib/supabase/server";

const TEACHER_STUDENT_ACCESS_BATCH_SIZE = 200;

/** Server-only guard using `teacher_can_access_student` (session teacher id must match argument). */
export async function teacherCanAccessStudentForSession(
	sessionTeacherId: string,
	studentId: string,
): Promise<boolean> {
	const supabase = await createClient();
	const { data, error } = await supabase.rpc("teacher_can_access_student", {
		p_teacher_id: sessionTeacherId,
		p_student_id: studentId,
	});
	if (error) {
		return false;
	}
	return Boolean(data);
}

/** Batched allowlist using the same database access rules as `teacher_can_access_student`. */
export async function teacherFilterAccessibleStudentIdsForSession(
	sessionTeacherId: string,
	studentIds: string[],
): Promise<Set<string>> {
	const uniqueStudentIds = [...new Set(studentIds)].filter(Boolean);
	if (uniqueStudentIds.length === 0) {
		return new Set();
	}

	const supabase = await createClient();
	const accessible = new Set<string>();

	for (let i = 0; i < uniqueStudentIds.length; i += TEACHER_STUDENT_ACCESS_BATCH_SIZE) {
		const batch = uniqueStudentIds.slice(i, i + TEACHER_STUDENT_ACCESS_BATCH_SIZE);
		const { data, error } = await supabase.rpc("teacher_filter_accessible_student_ids", {
			p_teacher_id: sessionTeacherId,
			p_student_ids: batch,
		});
		if (error || !Array.isArray(data)) {
			return new Set();
		}
		for (const id of data) {
			if (typeof id === "string") {
				accessible.add(id);
			}
		}
	}

	return accessible;
}
