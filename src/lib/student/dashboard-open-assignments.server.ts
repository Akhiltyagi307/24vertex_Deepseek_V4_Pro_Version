import "server-only";

import type { StudentAssignmentCard } from "@/lib/assignments/student-assignment-card";
import { listStudentAssignments } from "@/lib/assignments/queries";

import {
	filterOpenAssignments,
	sortOpenAssignmentsByUrgency,
} from "@/lib/student/dashboard-open-assignments";

export async function listOpenStudentAssignments(studentId: string): Promise<StudentAssignmentCard[]> {
	const all = await listStudentAssignments(studentId);
	return sortOpenAssignmentsByUrgency(filterOpenAssignments(all));
}
