import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { OPEN_ASSIGNMENT_LIFECYCLE_STATUSES } from "@/lib/student/dashboard-open-assignments";

const OPEN_STATUSES = [...OPEN_ASSIGNMENT_LIFECYCLE_STATUSES];

/**
 * True when the student has at least one published assignment submission that is
 * not yet submitted (to do or in progress).
 */
export async function hasOpenAssignmentsForStudent(studentId: string): Promise<boolean> {
	const row = await db
		.select({ id: assignmentSubmissions.id })
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.where(
			and(
				eq(assignmentSubmissions.studentId, studentId),
				eq(assignments.status, "published"),
				inArray(assignmentSubmissions.lifecycleStatus, OPEN_STATUSES),
			),
		)
		.limit(1);

	return row.length > 0;
}
