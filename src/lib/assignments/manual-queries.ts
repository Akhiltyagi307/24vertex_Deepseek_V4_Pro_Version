import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { tests } from "@/db/schema/assessment";
import { practiceJobs } from "@/db/schema/practice-tables";
import { assignmentQuestions, assignmentSubmissions, assignments } from "@/db/schema/teaching";

import { deriveManualConfig, manualQuestionsToDbRows, summarizeNotStartedImpact } from "./manual-helpers";
import type { ManualQuestionInput } from "./manual-schemas";

/** Submission lifecycles whose tests have NOT been started — safe to (re)materialize. */
const NOT_STARTED = ["pending_materialize", "ready", "failed_generation"] as const;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ManualHeader = {
	teacherId: string;
	organizationId: string | null;
	title: string;
	instructions: string | null;
	subjectId: string;
	difficulty: "easy" | "medium" | "hard";
	timeLimitSeconds: number;
	dueAt: string | null;
	questions: ManualQuestionInput[];
};

/** Replace the authored question template for an assignment inside a transaction. */
async function replaceAssignmentQuestions(
	tx: DbTransaction,
	assignmentId: string,
	questions: ManualQuestionInput[],
): Promise<void> {
	await tx.delete(assignmentQuestions).where(eq(assignmentQuestions.assignmentId, assignmentId));
	if (questions.length === 0) return;
	const now = new Date();
	await tx.insert(assignmentQuestions).values(
		manualQuestionsToDbRows(questions).map((row) => ({
			assignmentId,
			questionNumber: row.questionNumber,
			topicId: row.topicId,
			questionType: row.questionType,
			questionText: row.questionText,
			options: row.options as never,
			answerKey: row.answerKey as never,
			difficultyLevel: row.difficultyLevel,
			createdAt: now,
			updatedAt: now,
		})),
	);
}

/** Create a DRAFT manual assignment (or update an existing draft) and return its id. */
export async function saveManualAssignmentDraft(
	input: ManualHeader & { assignmentId: string | null; studentIds: string[] },
): Promise<{ assignmentId: string }> {
	const now = new Date();
	const config =
		input.questions.length > 0
			? deriveManualConfig({
					subjectId: input.subjectId,
					difficulty: input.difficulty,
					timeLimitSeconds: input.timeLimitSeconds,
					questions: input.questions,
				})
			: {
					v: 1 as const,
					kind: "practice_test" as const,
					authoring_mode: "manual" as const,
					subject_id: input.subjectId,
					topic_ids: [] as string[],
					difficulty: input.difficulty,
					question_count: 0,
					time_limit_seconds: input.timeLimitSeconds,
				};

	return db.transaction(async (tx) => {
		let assignmentId = input.assignmentId;
		if (assignmentId) {
			const [owned] = await tx
				.update(assignments)
				.set({
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					updatedAt: now,
				})
				.where(
					and(
						eq(assignments.id, assignmentId),
						eq(assignments.teacherId, input.teacherId),
						eq(assignments.status, "draft"),
					),
				)
				.returning({ id: assignments.id });
			if (!owned) throw new Error("Draft not found or not editable.");
		} else {
			const [created] = await tx
				.insert(assignments)
				.values({
					teacherId: input.teacherId,
					organizationId: input.organizationId,
					assignmentKind: "practice_test",
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "draft",
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: assignments.id });
			if (!created) throw new Error("Could not create draft.");
			assignmentId = created.id;
		}
		await replaceAssignmentQuestions(tx, assignmentId, input.questions);
		return { assignmentId };
	});
}

/** Publish a manual assignment: persist questions + fan out submissions/jobs. */
export async function createPublishedManualAssignment(
	input: ManualHeader & { studentIds: string[]; fromDraftId: string | null },
): Promise<{ assignmentId: string; submissionIds: string[] }> {
	const now = new Date();
	const config = deriveManualConfig({
		subjectId: input.subjectId,
		difficulty: input.difficulty,
		timeLimitSeconds: input.timeLimitSeconds,
		questions: input.questions,
	});

	return db.transaction(async (tx) => {
		let assignmentId = input.fromDraftId;
		if (assignmentId) {
			const [owned] = await tx
				.update(assignments)
				.set({
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "published",
					publishedAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(assignments.id, assignmentId),
						eq(assignments.teacherId, input.teacherId),
						eq(assignments.status, "draft"),
					),
				)
				.returning({ id: assignments.id });
			if (!owned) throw new Error("Draft not found or not editable.");
		} else {
			const [created] = await tx
				.insert(assignments)
				.values({
					teacherId: input.teacherId,
					organizationId: input.organizationId,
					assignmentKind: "practice_test",
					title: input.title,
					instructions: input.instructions,
					config,
					dueAt: input.dueAt ? new Date(input.dueAt) : null,
					status: "published",
					publishedAt: now,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: assignments.id });
			if (!created) throw new Error("Could not create assignment.");
			assignmentId = created.id;
		}

		await replaceAssignmentQuestions(tx, assignmentId, input.questions);

		const submissionRows = await tx
			.insert(assignmentSubmissions)
			.values(
				input.studentIds.map((studentId) => ({
					assignmentId: assignmentId!,
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
				runAfter: now, // no LLM → no staggering
				createdAt: now,
				updatedAt: now,
			})),
		);

		return { assignmentId, submissionIds: submissionRows.map((r) => r.id) };
	});
}

export type ManualAssignmentForEdit = {
	assignmentId: string;
	title: string;
	instructions: string | null;
	subjectId: string;
	difficulty: string;
	timeLimitSeconds: number;
	dueAt: string | null;
	status: string;
	questions: Array<{
		topicId: string;
		questionType: string;
		questionText: string;
		options: unknown | null;
		answerKey: unknown;
		difficultyLevel: string;
	}>;
};

/** Load a manual assignment (draft or published) the teacher owns, for the editor. */
export async function getManualAssignmentForEdit(
	teacherId: string,
	assignmentId: string,
): Promise<ManualAssignmentForEdit | null> {
	const [row] = await db
		.select()
		.from(assignments)
		.where(and(eq(assignments.id, assignmentId), eq(assignments.teacherId, teacherId)))
		.limit(1);
	if (!row) return null;
	const config = (row.config ?? {}) as Record<string, unknown>;
	if (config.authoring_mode !== "manual") return null;

	const questions = await db
		.select()
		.from(assignmentQuestions)
		.where(eq(assignmentQuestions.assignmentId, assignmentId))
		.orderBy(assignmentQuestions.questionNumber);

	return {
		assignmentId: row.id,
		title: row.title,
		instructions: row.instructions,
		subjectId: String(config.subject_id ?? ""),
		difficulty: String(config.difficulty ?? "medium"),
		timeLimitSeconds: Number(config.time_limit_seconds ?? 3600),
		dueAt: row.dueAt ? row.dueAt.toISOString() : null,
		status: row.status,
		questions: questions.map((q) => ({
			topicId: q.topicId,
			questionType: q.questionType,
			questionText: q.questionText,
			options: q.options,
			answerKey: q.answerKey,
			difficultyLevel: q.difficultyLevel,
		})),
	};
}

/**
 * Edit a PUBLISHED manual assignment. Replaces the template and re-materializes
 * ONLY not-yet-started submissions. Started/graded submissions are frozen.
 *
 * The conditional reset (`WHERE lifecycle_status IN NOT_STARTED`) is race-safe:
 * a student who transitions ready -> in_progress mid-edit is excluded and keeps
 * their pre-edit test.
 */
export async function updatePublishedManualAssignment(
	input: ManualHeader & { assignmentId: string },
): Promise<{ appliedToNotStarted: number; skippedAlreadyStarted: number; resetSubmissionIds: string[] }> {
	const now = new Date();
	const config = deriveManualConfig({
		subjectId: input.subjectId,
		difficulty: input.difficulty,
		timeLimitSeconds: input.timeLimitSeconds,
		questions: input.questions,
	});

	return db.transaction(async (tx) => {
		const [owned] = await tx
			.update(assignments)
			.set({
				title: input.title,
				instructions: input.instructions,
				config,
				dueAt: input.dueAt ? new Date(input.dueAt) : null,
				updatedAt: now,
			})
			.where(
				and(
					eq(assignments.id, input.assignmentId),
					eq(assignments.teacherId, input.teacherId),
					eq(assignments.status, "published"),
				),
			)
			.returning({ id: assignments.id });
		if (!owned) throw new Error("Published assignment not found or not owned.");

		await replaceAssignmentQuestions(tx, input.assignmentId, input.questions);

		const countRows = await tx
			.select({
				lifecycleStatus: assignmentSubmissions.lifecycleStatus,
				n: sql<number>`count(*)::int`,
			})
			.from(assignmentSubmissions)
			.where(eq(assignmentSubmissions.assignmentId, input.assignmentId))
			.groupBy(assignmentSubmissions.lifecycleStatus);
		const counts: Record<string, number> = {};
		for (const r of countRows) counts[r.lifecycleStatus] = Number(r.n);
		const impact = summarizeNotStartedImpact(counts);

		const resetRows = await tx
			.update(assignmentSubmissions)
			.set({ lifecycleStatus: "pending_materialize", testId: null, error: null, updatedAt: now })
			.where(
				and(
					eq(assignmentSubmissions.assignmentId, input.assignmentId),
					inArray(assignmentSubmissions.lifecycleStatus, [...NOT_STARTED]),
				),
			)
			.returning({ id: assignmentSubmissions.id, testId: assignmentSubmissions.testId });

		const staleTestIds = resetRows.map((r) => r.testId).filter((id): id is string => Boolean(id));
		if (staleTestIds.length > 0) {
			// Cascades the copied questions; not-started tests have no student_answers.
			await tx.delete(tests).where(inArray(tests.id, staleTestIds));
		}

		const resetIds = resetRows.map((r) => r.id);
		if (resetIds.length > 0) {
			const studentRows = await tx
				.select({ id: assignmentSubmissions.id, studentId: assignmentSubmissions.studentId })
				.from(assignmentSubmissions)
				.where(inArray(assignmentSubmissions.id, resetIds));
			const studentById = new Map(studentRows.map((r) => [r.id, r.studentId]));
			// Free the partial unique index, then re-enqueue fresh materialization jobs.
			await tx
				.delete(practiceJobs)
				.where(
					and(
						inArray(practiceJobs.assignmentSubmissionId, resetIds),
						eq(practiceJobs.jobType, "assign_generate_test"),
						inArray(practiceJobs.status, ["pending", "running"]),
					),
				);
			await tx.insert(practiceJobs).values(
				resetIds.map((submissionId) => ({
					jobType: "assign_generate_test",
					testId: null,
					studentId: studentById.get(submissionId)!,
					assignmentSubmissionId: submissionId,
					payload: { assignment_submission_id: submissionId },
					runAfter: now,
					createdAt: now,
					updatedAt: now,
				})),
			);
		}

		return { ...impact, resetSubmissionIds: resetIds };
	});
}

export type ManualDraftSummary = { id: string; title: string; questionCount: number; updatedAt: string | null };

/** List the teacher's saved MANUAL drafts (status='draft'), newest first, for resume. */
export async function listTeacherManualDrafts(teacherId: string): Promise<ManualDraftSummary[]> {
	const rows = await db
		.select({
			id: assignments.id,
			title: assignments.title,
			updatedAt: assignments.updatedAt,
			config: assignments.config,
		})
		.from(assignments)
		.where(and(eq(assignments.teacherId, teacherId), eq(assignments.status, "draft")))
		.orderBy(desc(assignments.updatedAt));

	return rows
		.filter((r) => (r.config as Record<string, unknown> | null)?.authoring_mode === "manual")
		.map((r) => {
			const cfg = (r.config ?? {}) as Record<string, unknown>;
			const count = typeof cfg.question_count === "number" ? cfg.question_count : 0;
			return {
				id: r.id,
				title: r.title,
				questionCount: count,
				updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
			};
		});
}
