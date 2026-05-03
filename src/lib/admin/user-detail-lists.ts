import "server-only";

/**
 * L2 user-360 list queries (Phase 4). Product alignment: admin Phase 1 migration
 * (profiles, audit) and Phase 3 assessment ops; canonical PDR markdown may live
 * outside this repo — see PRODUCT.md.
 */

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { notifications } from "@/db/schema/comms-audit";
import { parentStudentLinks, profiles } from "@/db/schema/profiles";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";

/** Single-line preview for L2 tables (notifications, long titles). */
export function truncateForAdminPreview(text: string, maxLen: number): string {
	const t = text.replace(/\s+/g, " ").trim();
	if (t.length <= maxLen) return t;
	return `${t.slice(0, maxLen)}…`;
}

export type AdminUserAssignmentSubmissionRow = {
	submission_id: string;
	assignment_id: string;
	assignment_title: string;
	subject_name: string | null;
	status: string | null;
	score: string | null;
	is_late: boolean | null;
	submitted_at: string | null;
	test_id: string | null;
	updated_at: string | null;
	due_date: string | null;
};

export async function adminListAssignmentSubmissionsForStudent(
	studentId: string,
	page: number,
	pageSize: number,
): Promise<{ rows: AdminUserAssignmentSubmissionRow[]; total: number }> {
	const ps = Math.min(100, Math.max(1, pageSize));
	const p = Math.max(1, page);
	const offset = (p - 1) * ps;

	const whereSql = eq(assignmentSubmissions.studentId, studentId);

	const [countRow] = await db.select({ c: count() }).from(assignmentSubmissions).where(whereSql);
	const total = Number(countRow?.c ?? 0);

	const raw = await db
		.select({
			submissionId: assignmentSubmissions.id,
			assignmentId: assignments.id,
			title: assignments.title,
			subjectName: subjects.name,
			status: assignmentSubmissions.status,
			score: assignmentSubmissions.score,
			isLate: assignmentSubmissions.isLate,
			submittedAt: assignmentSubmissions.submittedAt,
			testId: assignmentSubmissions.testId,
			updatedAt: assignmentSubmissions.updatedAt,
			dueDate: assignments.dueDate,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
		.innerJoin(subjects, eq(assignments.subjectId, subjects.id))
		.where(whereSql)
		.orderBy(desc(assignmentSubmissions.updatedAt))
		.limit(ps)
		.offset(offset);

	const rows: AdminUserAssignmentSubmissionRow[] = raw.map((r) => ({
		submission_id: r.submissionId,
		assignment_id: r.assignmentId,
		assignment_title: r.title,
		subject_name: r.subjectName,
		status: r.status,
		score: r.score != null ? String(r.score) : null,
		is_late: r.isLate,
		submitted_at: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : (r.submittedAt ?? null),
		test_id: r.testId,
		updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ?? null),
		due_date: r.dueDate instanceof Date ? r.dueDate.toISOString() : (r.dueDate ?? null),
	}));

	return { rows, total };
}

export type AdminUserNotificationRow = {
	id: string;
	title: string;
	type: string;
	category: string | null;
	body_preview: string;
	is_read: boolean | null;
	email_sent: boolean | null;
	email_sent_at: string | null;
	created_at: string | null;
};

export async function adminListNotificationsForUser(
	userId: string,
	page: number,
	pageSize: number,
): Promise<{ rows: AdminUserNotificationRow[]; total: number }> {
	const ps = Math.min(100, Math.max(1, pageSize));
	const p = Math.max(1, page);
	const offset = (p - 1) * ps;

	const whereSql = eq(notifications.recipientId, userId);

	const [countRow] = await db.select({ c: count() }).from(notifications).where(whereSql);
	const total = Number(countRow?.c ?? 0);

	const raw = await db
		.select({
			id: notifications.id,
			title: notifications.title,
			body: notifications.body,
			type: notifications.type,
			category: notifications.category,
			isRead: notifications.isRead,
			emailSent: notifications.emailSent,
			emailSentAt: notifications.emailSentAt,
			createdAt: notifications.createdAt,
		})
		.from(notifications)
		.where(whereSql)
		.orderBy(desc(notifications.createdAt))
		.limit(ps)
		.offset(offset);

	const rows: AdminUserNotificationRow[] = raw.map((r) => ({
		id: r.id,
		title: r.title,
		type: r.type,
		category: r.category,
		body_preview: truncateForAdminPreview(r.body, 200),
		is_read: r.isRead,
		email_sent: r.emailSent,
		email_sent_at: r.emailSentAt instanceof Date ? r.emailSentAt.toISOString() : (r.emailSentAt ?? null),
		created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? null),
	}));

	return { rows, total };
}

export type AdminTeacherAssignmentRow = {
	id: string;
	title: string;
	status: string | null;
	due_date: string | null;
	subject_name: string | null;
	updated_at: string | null;
};

export async function adminListAssignmentsForTeacher(
	teacherId: string,
	page: number,
	pageSize: number,
): Promise<{ rows: AdminTeacherAssignmentRow[]; total: number }> {
	const ps = Math.min(100, Math.max(1, pageSize));
	const p = Math.max(1, page);
	const offset = (p - 1) * ps;

	const whereSql = eq(assignments.teacherId, teacherId);

	const [countRow] = await db.select({ c: count() }).from(assignments).where(whereSql);
	const total = Number(countRow?.c ?? 0);

	const raw = await db
		.select({
			id: assignments.id,
			title: assignments.title,
			status: assignments.status,
			dueDate: assignments.dueDate,
			subjectName: subjects.name,
			updatedAt: assignments.updatedAt,
		})
		.from(assignments)
		.innerJoin(subjects, eq(assignments.subjectId, subjects.id))
		.where(whereSql)
		.orderBy(desc(assignments.updatedAt))
		.limit(ps)
		.offset(offset);

	const rows: AdminTeacherAssignmentRow[] = raw.map((r) => ({
		id: r.id,
		title: r.title,
		status: r.status,
		due_date: r.dueDate instanceof Date ? r.dueDate.toISOString() : (r.dueDate ?? null),
		subject_name: r.subjectName,
		updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ?? null),
	}));

	return { rows, total };
}

export type AdminParentLinkedStudentRow = {
	student_id: string;
	full_name: string;
	link_status: string | null;
	linked_at: string | null;
	grade: number | null;
	section: string | null;
};

export async function adminListLinkedStudentsForParent(parentId: string): Promise<AdminParentLinkedStudentRow[]> {
	const raw = await db
		.select({
			studentId: parentStudentLinks.studentId,
			status: parentStudentLinks.status,
			linkedAt: parentStudentLinks.linkedAt,
			fullName: profiles.fullName,
			grade: profiles.grade,
			section: profiles.section,
		})
		.from(parentStudentLinks)
		.innerJoin(profiles, eq(parentStudentLinks.studentId, profiles.id))
		.where(and(eq(parentStudentLinks.parentId, parentId), eq(profiles.role, "student")))
		.orderBy(desc(parentStudentLinks.createdAt));

	return raw.map((r) => ({
		student_id: r.studentId,
		full_name: r.fullName,
		link_status: r.status,
		linked_at: r.linkedAt instanceof Date ? r.linkedAt.toISOString() : (r.linkedAt ?? null),
		grade: r.grade,
		section: r.section,
	}));
}
