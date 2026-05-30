import "server-only";

import { and, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { profiles } from "@/db/schema/profiles";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { fetchSubjectNameMap } from "@/lib/academic/subject-names";
import { assignmentConfigSchema } from "@/lib/assignments/schemas";

export type AdminAssignmentListRow = {
	id: string;
	title: string;
	teacher_id: string;
	teacher_name: string | null;
	subject_id: string | null;
	subject_name: string | null;
	status: string | null;
	due_date: string | null;
	submissions_count: number;
	updated_at: string | null;
	created_at: string | null;
};

export async function adminListAssignments(input: {
	page: number;
	pageSize: number;
	status?: string | null;
	q?: string | null;
}): Promise<{ rows: AdminAssignmentListRow[]; total: number }> {
	const ps = Math.min(100, Math.max(1, input.pageSize));
	const p = Math.max(1, input.page);
	const offset = (p - 1) * ps;

	const conditions = [];
	if (input.status?.trim()) conditions.push(eq(assignments.status, input.status.trim()));
	const qTrim = input.q?.trim();
	if (qTrim) conditions.push(ilike(assignments.title, `%${qTrim}%`));
	const whereClause = conditions.length ? and(...conditions) : undefined;

	const [{ c: total }] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(assignments)
		.where(whereClause);

	const raw = await db
		.select({
			id: assignments.id,
			title: assignments.title,
			teacherId: assignments.teacherId,
			teacherName: profiles.fullName,
			config: assignments.config,
			status: assignments.status,
			dueAt: assignments.dueAt,
			updatedAt: assignments.updatedAt,
			createdAt: assignments.createdAt,
		})
		.from(assignments)
		.leftJoin(profiles, eq(assignments.teacherId, profiles.id))
		.where(whereClause)
		.orderBy(desc(assignments.updatedAt))
		.limit(ps)
		.offset(offset);

	const ids = raw.map((r) => r.id);
	const counts =
		ids.length === 0
			? []
			: await db
					.select({
						assignmentId: assignmentSubmissions.assignmentId,
						n: count(),
					})
					.from(assignmentSubmissions)
					.where(inArray(assignmentSubmissions.assignmentId, ids))
					.groupBy(assignmentSubmissions.assignmentId);

	const countMap = new Map<string, number>(counts.map((r) => [r.assignmentId, Number(r.n)]));

	const configByAssignment = new Map(
		raw.map((r) => [r.id, assignmentConfigSchema.safeParse(r.config)]),
	);
	const subjectIds = [
		...new Set(
			[...configByAssignment.values()].flatMap((result) => (result.success ? [result.data.subject_id] : [])),
		),
	];
	const subjectMap = await fetchSubjectNameMap(subjectIds);

	const rows: AdminAssignmentListRow[] = raw.map((r) => {
		const config = configByAssignment.get(r.id);
		const subjectId = config?.success ? config.data.subject_id : null;
		return {
			id: r.id,
			title: r.title,
			teacher_id: r.teacherId,
			teacher_name: r.teacherName ?? null,
			subject_id: subjectId,
			subject_name: subjectId ? (subjectMap.get(subjectId) ?? null) : null,
			status: r.status ?? null,
			due_date: r.dueAt instanceof Date ? r.dueAt.toISOString() : (r.dueAt ?? null),
			submissions_count: countMap.get(r.id) ?? 0,
			updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ?? null),
			created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ?? null),
		};
	});

	return { rows, total: Number(total) || 0 };
}

export type AdminAssignmentDetail = {
	id: string;
	title: string;
	description: string | null;
	assignment_type: string | null;
	teacher_id: string;
	teacher_name: string | null;
	subject_id: string | null;
	subject_name: string | null;
	topic_ids: string[];
	difficulty: string | null;
	question_count: number | null;
	time_limit_seconds: number | null;
	due_date: string | null;
	instructions: string | null;
	status: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type AdminAssignmentSubmissionRow = {
	id: string;
	student_id: string;
	student_name: string | null;
	status: string | null;
	score: string | null;
	is_late: boolean | null;
	test_id: string | null;
	submitted_at: string | null;
	updated_at: string | null;
};

export type AdminAssignmentBundle = {
	assignment: AdminAssignmentDetail;
	submissions: AdminAssignmentSubmissionRow[];
	submissions_total: number;
};

const SUBMISSIONS_DISPLAY_LIMIT = 200;

export async function adminGetAssignmentDetail(id: string): Promise<AdminAssignmentBundle | null> {
	const rows = await db
		.select({
			a: assignments,
			teacherName: profiles.fullName,
		})
		.from(assignments)
		.leftJoin(profiles, eq(assignments.teacherId, profiles.id))
		.where(eq(assignments.id, id))
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	const a = row.a;
	const config = assignmentConfigSchema.safeParse(a.config);
	const subjectId = config.success ? config.data.subject_id : null;
	const [subjectRow] =
		subjectId ?
			await db.select({ name: subjects.name }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
		:	[];
	const detail: AdminAssignmentDetail = {
		id: a.id,
		title: a.title,
		description: null,
		assignment_type: a.assignmentKind ?? null,
		teacher_id: a.teacherId,
		teacher_name: row.teacherName ?? null,
		subject_id: subjectId,
		subject_name: subjectRow?.name ?? null,
		topic_ids: config.success ? config.data.topic_ids : [],
		difficulty: config.success ? config.data.difficulty : null,
		question_count: config.success ? config.data.question_count : null,
		time_limit_seconds: config.success ? config.data.time_limit_seconds : null,
		due_date: a.dueAt instanceof Date ? a.dueAt.toISOString() : (a.dueAt ?? null),
		instructions: a.instructions ?? null,
		status: a.status ?? null,
		created_at: a.createdAt instanceof Date ? a.createdAt.toISOString() : (a.createdAt ?? null),
		updated_at: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : (a.updatedAt ?? null),
	};

	const subRaw = await db
		.select({
			id: assignmentSubmissions.id,
			studentId: assignmentSubmissions.studentId,
			studentName: profiles.fullName,
			status: assignmentSubmissions.lifecycleStatus,
			score: assignmentSubmissions.score,
			isLate: assignmentSubmissions.isLate,
			testId: assignmentSubmissions.testId,
			submittedAt: assignmentSubmissions.submittedAt,
			updatedAt: assignmentSubmissions.updatedAt,
		})
		.from(assignmentSubmissions)
		.leftJoin(profiles, eq(assignmentSubmissions.studentId, profiles.id))
		.where(eq(assignmentSubmissions.assignmentId, id))
		.orderBy(desc(assignmentSubmissions.updatedAt))
		.limit(SUBMISSIONS_DISPLAY_LIMIT);

	const [countRow] = await db
		.select({ c: count() })
		.from(assignmentSubmissions)
		.where(eq(assignmentSubmissions.assignmentId, id));

	const submissions: AdminAssignmentSubmissionRow[] = subRaw.map((r) => ({
		id: r.id,
		student_id: r.studentId,
		student_name: r.studentName ?? null,
		status: r.status ?? null,
		score: r.score != null ? String(r.score) : null,
		is_late: r.isLate ?? null,
		test_id: r.testId ?? null,
		submitted_at: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : (r.submittedAt ?? null),
		updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ?? null),
	}));

	return {
		assignment: detail,
		submissions,
		submissions_total: Number(countRow?.c ?? 0),
	};
}
