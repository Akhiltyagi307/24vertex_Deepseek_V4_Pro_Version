import "server-only";

import { db } from "@/db";
import { teacherApprovalHistory, type TeacherApprovalAction } from "@/db/schema/teacher-approval-history";

export type RecordTeacherApprovalHistoryInput = {
	teacherUserId: string;
	email: string;
	action: TeacherApprovalAction;
	actorAdminId?: string | null;
	reason?: string | null;
};

/**
 * Append a row to `teacher_approval_history` describing an admin-driven
 * transition of a teacher's verification status. Used by:
 *   - `POST /api/admin/teachers/[id]/approve` — emits `action='verified'`.
 *   - Future admin reject/unapprove route — emits `action='rejected'` or
 *     `action='unverified'`.
 *   - `hasRecentTeacherRejection` (auth-side cooldown check) reads back the
 *     same rows.
 *
 * Email is stored verbatim and matched case-insensitively at read time by
 * the functional index on `lower(email)`.
 */
export async function recordTeacherApprovalHistory(input: RecordTeacherApprovalHistoryInput): Promise<void> {
	await db.insert(teacherApprovalHistory).values({
		teacherUserId: input.teacherUserId,
		email: input.email,
		action: input.action,
		actorAdminId: input.actorAdminId ?? null,
		reason: input.reason ?? null,
	});
}
