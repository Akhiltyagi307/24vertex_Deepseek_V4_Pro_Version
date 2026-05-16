import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { performanceTracker } from "@/db/schema/assessment";
import { practiceJobs } from "@/db/schema/practice-tables";
import { profiles } from "@/db/schema/profiles";
import { assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	listTeacherPerformanceDirectoryStudents,
	type TeacherPerformanceStudentRow,
} from "@/lib/teachers/teacher-performance-directory-queries";

import {
	assignmentConfigSchema,
	computeAssignmentJobRunAfter,
	type AssignmentConfig,
} from "./schemas";

export type AssignmentTopicCatalogRow = {
	id: string;
	subjectId: string;
	unitNumber: number;
	unitName: string;
	chapterNumber: number;
	chapterName: string;
	topicNumber: number;
	topicName: string;
};

/** Per-student rows for a teacher’s assignments (published only). */
export type TeacherAssignmentSubmissionRow = {
	assignmentId: string;
	assignmentTitle: string;
	dueAt: string | null;
	createdAt: string | null;
	subjectName: string | null;
	studentId: string;
	studentFullName: string;
	studentGrade: number | null;
	studentSection: string | null;
	lifecycleStatus: string;
	score: string | null;
	testId: string | null;
	submittedAt: string | null;
	gradedAt: string | null;
};

export type TeacherAssignmentSummaryRow = {
	id: string;
	title: string;
	instructions: string | null;
	status: string;
	dueAt: string | null;
	createdAt: string | null;
	subjectName: string | null;
	config: AssignmentConfig;
	counts: {
		assigned: number;
		ready: number;
		inProgress: number;
		submitted: number;
		grading: number;
		graded: number;
		failedGeneration: number;
		gradingFailed: number;
	};
	averageScore: number | null;
};

export type StudentAssignmentCard = {
	id: string;
	assignmentId: string;
	title: string;
	instructions: string | null;
	lifecycleStatus: string;
	testId: string | null;
	score: string | null;
	dueAt: string | null;
	createdAt: string | null;
	submittedAt: string | null;
	gradedAt: string | null;
	subjectName: string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : value;
}

export async function listAssignmentTopicCatalog(): Promise<AssignmentTopicCatalogRow[]> {
	const rows = await db
		.select({
			id: topics.id,
			subjectId: topics.subjectId,
			unitNumber: topics.unitNumber,
			unitName: topics.unitName,
			chapterNumber: topics.chapterNumber,
			chapterName: topics.chapterName,
			topicNumber: topics.topicNumber,
			topicName: topics.topicName,
		})
		.from(topics)
		.where(eq(topics.isActive, true))
		.orderBy(asc(topics.grade), asc(topics.unitNumber), asc(topics.chapterNumber), asc(topics.topicNumber));
	return rows;
}

export async function listTeacherAssignmentSubjectCatalog(teacherId: string): Promise<AssignmentTopicCatalogRow[]> {
	const activeOrganization = await getActiveTeacherOrganizationSnapshot(teacherId);
	const [teacher] = await db
		.select({ teacherRosterSubjectId: profiles.teacherRosterSubjectId })
		.from(profiles)
		.where(eq(profiles.id, teacherId))
		.limit(1);

	if (!activeOrganization) return listAssignmentTopicCatalog();
	const subjectId = teacher?.teacherRosterSubjectId;
	if (!subjectId) return [];

	const rows = await db
		.select({
			id: topics.id,
			subjectId: topics.subjectId,
			unitNumber: topics.unitNumber,
			unitName: topics.unitName,
			chapterNumber: topics.chapterNumber,
			chapterName: topics.chapterName,
			topicNumber: topics.topicNumber,
			topicName: topics.topicName,
		})
		.from(topics)
		.where(and(eq(topics.isActive, true), eq(topics.subjectId, subjectId)))
		.orderBy(asc(topics.grade), asc(topics.unitNumber), asc(topics.chapterNumber), asc(topics.topicNumber));
	return rows;
}

export async function listTeacherAssignableStudents(teacherId: string): Promise<TeacherPerformanceStudentRow[]> {
	const activeOrganization = await getActiveTeacherOrganizationSnapshot(teacherId);
	if (activeOrganization) {
		const [teacher] = await db
			.select({
				grade: profiles.teacherRosterGrade,
				subjectId: profiles.teacherRosterSubjectId,
			})
			.from(profiles)
			.where(eq(profiles.id, teacherId))
			.limit(1);
		if (teacher?.grade == null || !teacher.subjectId) return [];
		return listTeacherPerformanceDirectoryStudents({
			teacherId,
			activeOrganizationId: activeOrganization.id,
			grade: teacher.grade,
			subjectId: teacher.subjectId,
		});
	}
	return listTeacherPerformanceDirectoryStudents({
		teacherId,
		activeOrganizationId: null,
	});
}

export async function listTeacherAssignmentSummaries(
	teacherId: string,
): Promise<TeacherAssignmentSummaryRow[]> {
	const assignmentRows = await db
		.select()
		.from(assignments)
		.where(eq(assignments.teacherId, teacherId))
		.orderBy(desc(assignments.createdAt));

	if (assignmentRows.length === 0) return [];

	const ids = assignmentRows.map((row) => row.id);
	const counts = await db
		.select({
			assignmentId: assignmentSubmissions.assignmentId,
			assigned: sql<number>`count(*)::int`,
			ready: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'ready')::int`,
			inProgress: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'in_progress')::int`,
			submitted: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'submitted')::int`,
			grading: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'grading')::int`,
			graded: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'graded')::int`,
			failedGeneration: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'failed_generation')::int`,
			gradingFailed: sql<number>`count(*) filter (where ${assignmentSubmissions.lifecycleStatus} = 'grading_failed')::int`,
			averageScore: sql<string | null>`avg(${assignmentSubmissions.score})::text`,
		})
		.from(assignmentSubmissions)
		.where(inArray(assignmentSubmissions.assignmentId, ids))
		.groupBy(assignmentSubmissions.assignmentId);
	const countsByAssignment = new Map(counts.map((row) => [row.assignmentId, row]));

	const configs = assignmentRows.map((row) => assignmentConfigSchema.safeParse(row.config));
	const subjectIds = [...new Set(configs.flatMap((result) => (result.success ? [result.data.subject_id] : [])))];
	const subjectRows =
		subjectIds.length > 0 ?
			await db
				.select({ id: subjects.id, name: subjects.name })
				.from(subjects)
				.where(inArray(subjects.id, subjectIds))
		:	[];
	const subjectNameById = new Map(subjectRows.map((row) => [row.id, row.name]));

	return assignmentRows.flatMap((row, index) => {
		const config = configs[index];
		if (!config?.success) return [];
		const countRow = countsByAssignment.get(row.id);
		return [
			{
				id: row.id,
				title: row.title,
				instructions: row.instructions,
				status: row.status,
				dueAt: toIso(row.dueAt),
				createdAt: toIso(row.createdAt),
				subjectName: subjectNameById.get(config.data.subject_id) ?? null,
				config: config.data,
				counts: {
					assigned: Number(countRow?.assigned ?? 0),
					ready: Number(countRow?.ready ?? 0),
					inProgress: Number(countRow?.inProgress ?? 0),
					submitted: Number(countRow?.submitted ?? 0),
					grading: Number(countRow?.grading ?? 0),
					graded: Number(countRow?.graded ?? 0),
					failedGeneration: Number(countRow?.failedGeneration ?? 0),
					gradingFailed: Number(countRow?.gradingFailed ?? 0),
				},
				averageScore: countRow?.averageScore == null ? null : Number(countRow.averageScore),
			},
		];
	});
}

export async function listTeacherAssignmentSubmissionRows(
	teacherId: string,
): Promise<TeacherAssignmentSubmissionRow[]> {
	const rows = await db
		.select({
			assignmentId: assignments.id,
			assignmentTitle: assignments.title,
			dueAt: assignments.dueAt,
			createdAt: assignments.createdAt,
			config: assignments.config,
			studentId: profiles.id,
			studentFullName: profiles.fullName,
			studentGrade: profiles.grade,
			studentSection: profiles.section,
			lifecycleStatus: assignmentSubmissions.lifecycleStatus,
			score: assignmentSubmissions.score,
			testId: assignmentSubmissions.testId,
			submittedAt: assignmentSubmissions.submittedAt,
			gradedAt: assignmentSubmissions.gradedAt,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.innerJoin(profiles, eq(profiles.id, assignmentSubmissions.studentId))
		.where(
			and(eq(assignments.teacherId, teacherId), eq(assignments.status, "published"), eq(profiles.role, "student")),
		)
		.orderBy(desc(assignments.createdAt), asc(profiles.fullName));

	const configs = rows.map((row) => assignmentConfigSchema.safeParse(row.config));
	const subjectIds = [...new Set(configs.flatMap((result) => (result.success ? [result.data.subject_id] : [])))];
	const subjectRows =
		subjectIds.length > 0 ?
			await db
				.select({ id: subjects.id, name: subjects.name })
				.from(subjects)
				.where(inArray(subjects.id, subjectIds))
		:	[];
	const subjectNameById = new Map(subjectRows.map((row) => [row.id, row.name]));

	return rows.flatMap((row, index) => {
		const config = configs[index];
		const subjectName = config.success ? (subjectNameById.get(config.data.subject_id) ?? null) : null;
		return [
			{
				assignmentId: row.assignmentId,
				assignmentTitle: row.assignmentTitle,
				dueAt: toIso(row.dueAt),
				createdAt: toIso(row.createdAt),
				subjectName,
				studentId: row.studentId,
				studentFullName: row.studentFullName,
				studentGrade: row.studentGrade,
				studentSection: row.studentSection,
				lifecycleStatus: row.lifecycleStatus,
				score: row.score != null ? String(row.score) : null,
				testId: row.testId,
				submittedAt: toIso(row.submittedAt),
				gradedAt: toIso(row.gradedAt),
			},
		];
	});
}

export async function createPublishedPracticeAssignment(input: {
	teacherId: string;
	organizationId: string | null;
	title: string;
	instructions: string | null;
	config: AssignmentConfig;
	studentIds: string[];
	dueAt: string | null;
}): Promise<{ assignmentId: string; submissionIds: string[] }> {
	const now = new Date();
	const result = await db.transaction(async (tx) => {
		const [assignment] = await tx
			.insert(assignments)
			.values({
				teacherId: input.teacherId,
				organizationId: input.organizationId,
				assignmentKind: input.config.kind,
				title: input.title,
				instructions: input.instructions,
				config: input.config,
				dueAt: input.dueAt ? new Date(input.dueAt) : null,
				status: "published",
				publishedAt: now,
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: assignments.id });

		if (!assignment) throw new Error("Could not create assignment.");

		const submissionRows = await tx
			.insert(assignmentSubmissions)
			.values(
				input.studentIds.map((studentId) => ({
					assignmentId: assignment.id,
					studentId,
					lifecycleStatus: "pending_materialize",
					createdAt: now,
					updatedAt: now,
				})),
			)
			.returning({ id: assignmentSubmissions.id });

		await tx.insert(practiceJobs).values(
			submissionRows.map((submission, index) => ({
				jobType: "assign_generate_test",
				testId: null,
				studentId: input.studentIds[index],
				assignmentSubmissionId: submission.id,
				payload: { assignment_submission_id: submission.id },
				runAfter: computeAssignmentJobRunAfter(now, index),
				createdAt: now,
				updatedAt: now,
			})),
		);

		return {
			assignmentId: assignment.id,
			submissionIds: submissionRows.map((row) => row.id),
		};
	});

	return result;
}

export async function validatePracticeAssignmentConfigForStudents(input: {
	activeOrganizationId: string | null;
	teacherRosterGrade: number | null;
	teacherRosterSubjectId: string | null;
	config: AssignmentConfig;
	studentIds: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
	if (input.activeOrganizationId) {
		if (input.teacherRosterGrade == null || input.teacherRosterSubjectId == null) {
			return { ok: false, message: "Set your organization teaching grade and subject before assigning tests." };
		}
		if (input.teacherRosterSubjectId !== input.config.subject_id) {
			return { ok: false, message: "Select the subject configured for your organization teaching roster." };
		}
	}

	const topicRows = await db
		.select({ id: topics.id })
		.from(topics)
		.where(and(eq(topics.isActive, true), eq(topics.subjectId, input.config.subject_id), inArray(topics.id, input.config.topic_ids)));
	if (topicRows.length !== input.config.topic_ids.length) {
		return { ok: false, message: "One or more selected topics are not active for this subject." };
	}

	if (input.activeOrganizationId && input.teacherRosterGrade != null) {
		const studentRows = await db
			.select({ id: profiles.id, grade: profiles.grade })
			.from(profiles)
			.where(and(inArray(profiles.id, input.studentIds), eq(profiles.role, "student")));
		if (
			studentRows.length !== input.studentIds.length ||
			studentRows.some((student) => student.grade !== input.teacherRosterGrade)
		) {
			return { ok: false, message: "Selected students must be in your configured organization teaching grade." };
		}
	}

	const trackerRows = await db
		.select({
			studentId: performanceTracker.studentId,
			topicId: performanceTracker.topicId,
		})
		.from(performanceTracker)
		.where(
			and(
				inArray(performanceTracker.studentId, input.studentIds),
				eq(performanceTracker.subjectId, input.config.subject_id),
				inArray(performanceTracker.topicId, input.config.topic_ids),
			),
		);
	const required = new Set(input.config.topic_ids);
	const topicsByStudent = new Map<string, Set<string>>();
	for (const row of trackerRows) {
		if (!row.studentId || !row.topicId) continue;
		const studentTopics = topicsByStudent.get(row.studentId) ?? new Set<string>();
		studentTopics.add(row.topicId);
		topicsByStudent.set(row.studentId, studentTopics);
	}
	const missing = input.studentIds.some((studentId) => {
		const studentTopics = topicsByStudent.get(studentId);
		if (!studentTopics) return true;
		for (const topicId of required) {
			if (!studentTopics.has(topicId)) return true;
		}
		return false;
	});

	if (missing) {
		return { ok: false, message: "Selected students are missing tracker rows for one or more selected topics." };
	}

	return { ok: true };
}

export async function listStudentAssignments(studentId: string): Promise<StudentAssignmentCard[]> {
	return listAssignmentCardsForStudentIds([studentId]);
}

export async function listAssignmentCardsForStudentIds(studentIds: string[]): Promise<StudentAssignmentCard[]> {
	if (studentIds.length === 0) return [];
	const rows = await db
		.select({
			id: assignmentSubmissions.id,
			assignmentId: assignmentSubmissions.assignmentId,
			title: assignments.title,
			instructions: assignments.instructions,
			config: assignments.config,
			lifecycleStatus: assignmentSubmissions.lifecycleStatus,
			testId: assignmentSubmissions.testId,
			score: assignmentSubmissions.score,
			dueAt: assignments.dueAt,
			createdAt: assignments.createdAt,
			submittedAt: assignmentSubmissions.submittedAt,
			gradedAt: assignmentSubmissions.gradedAt,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.where(and(inArray(assignmentSubmissions.studentId, studentIds), eq(assignments.status, "published")))
		.orderBy(desc(assignments.createdAt));

	const configs = rows.map((row) => assignmentConfigSchema.safeParse(row.config));
	const subjectIds = [...new Set(configs.flatMap((result) => (result.success ? [result.data.subject_id] : [])))];
	const subjectRows =
		subjectIds.length > 0 ?
			await db
				.select({ id: subjects.id, name: subjects.name })
				.from(subjects)
				.where(inArray(subjects.id, subjectIds))
		:	[];
	const subjectNameById = new Map(subjectRows.map((row) => [row.id, row.name]));

	return rows.flatMap((row, index) => {
		const config = configs[index];
		return [
			{
				id: row.id,
				assignmentId: row.assignmentId,
				title: row.title,
				instructions: row.instructions,
				lifecycleStatus: row.lifecycleStatus,
				testId: row.testId,
				score: row.score,
				dueAt: toIso(row.dueAt),
				createdAt: toIso(row.createdAt),
				submittedAt: toIso(row.submittedAt),
				gradedAt: toIso(row.gradedAt),
				subjectName: config.success ? (subjectNameById.get(config.data.subject_id) ?? null) : null,
			},
		];
	});
}
