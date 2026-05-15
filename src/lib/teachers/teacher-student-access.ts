import "server-only";

import { createClient } from "@/lib/supabase/server";

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
