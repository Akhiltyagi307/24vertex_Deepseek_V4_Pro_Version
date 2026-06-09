import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { performanceTracker } from "@/db/schema/assessment";
import { assignmentQuestions, assignmentSubmissions, assignments } from "@/db/schema/teaching";
import { ensurePerformanceTrackerRowsForAssignmentTopics } from "@/lib/assignments/queries";
import { assignmentConfigBaseSchema, assignmentConfigSchema } from "@/lib/assignments/schemas";
import { notifyAssignmentMaterialized } from "@/lib/notifications/assignment-events";
import { resolvePracticeConfigForStudent } from "@/lib/practice";
import { runPracticeGenerationAfterResolve } from "@/lib/practice/practice-generation-pipeline";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type AssignmentGenerationResult =
	| { ok: true; testId: string }
	| { ok: false; message: string };

async function markSubmissionGenerationFailed(submissionId: string, message: string): Promise<void> {
	await db
		.update(assignmentSubmissions)
		.set({
			lifecycleStatus: "failed_generation",
			error: message.slice(0, 2000),
			updatedAt: new Date(),
		})
		.where(eq(assignmentSubmissions.id, submissionId));
}

export async function materializeAssignedPracticeTest(
	assignmentSubmissionId: string,
): Promise<AssignmentGenerationResult> {
	const [row] = await db
		.select({
			submissionId: assignmentSubmissions.id,
			studentId: assignmentSubmissions.studentId,
			testId: assignmentSubmissions.testId,
			lifecycleStatus: assignmentSubmissions.lifecycleStatus,
			assignmentId: assignments.id,
			assignmentTitle: assignments.title,
			assignmentStatus: assignments.status,
			config: assignments.config,
		})
		.from(assignmentSubmissions)
		.innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
		.where(eq(assignmentSubmissions.id, assignmentSubmissionId))
		.limit(1);

	if (!row) return { ok: false, message: "Assignment submission not found." };
	if (row.testId && row.lifecycleStatus !== "failed_generation") {
		return { ok: true, testId: row.testId };
	}
	if (row.assignmentStatus !== "published") {
		return { ok: false, message: "Assignment is not published." };
	}

	const baseConfig = assignmentConfigBaseSchema.safeParse(row.config);
	if (baseConfig.success && baseConfig.data.authoring_mode === "manual") {
		return materializeManualAssignedTest({
			submissionId: row.submissionId,
			studentId: row.studentId,
			assignmentId: row.assignmentId,
			assignmentTitle: row.assignmentTitle,
			subjectId: baseConfig.data.subject_id,
		});
	}

	const parsedConfig = assignmentConfigSchema.safeParse(row.config);
	if (!parsedConfig.success) {
		const message = "Assignment config is invalid.";
		await markSubmissionGenerationFailed(row.submissionId, message);
		return { ok: false, message };
	}
	const config = parsedConfig.data;

	await ensurePerformanceTrackerRowsForAssignmentTopics(
		row.studentId,
		config.subject_id,
		config.topic_ids,
	);

	const trackerRows = await db
		.select({
			id: performanceTracker.id,
			topicId: performanceTracker.topicId,
		})
		.from(performanceTracker)
		.where(
			and(
				eq(performanceTracker.studentId, row.studentId),
				eq(performanceTracker.subjectId, config.subject_id),
				inArray(performanceTracker.topicId, config.topic_ids),
			),
		);

	if (trackerRows.length !== config.topic_ids.length) {
		const message = "Student tracker rows are missing for one or more assignment topics.";
		await markSubmissionGenerationFailed(row.submissionId, message);
		return { ok: false, message };
	}

	const trackerIdByTopic = new Map(trackerRows.map((tracker) => [tracker.topicId, tracker.id]));
	const trackerIds = config.topic_ids.map((topicId) => trackerIdByTopic.get(topicId)).filter(Boolean) as string[];
	const practiceInput = {
		subjectId: config.subject_id,
		trackerIds,
		difficulty: config.difficulty,
		durationSeconds: config.time_limit_seconds,
	};

	const admin = createServiceRoleClient();
	const resolved = await resolvePracticeConfigForStudent(admin, practiceInput, { id: row.studentId });
	if (!resolved.ok) {
		await markSubmissionGenerationFailed(row.submissionId, resolved.message);
		return { ok: false, message: resolved.message };
	}

	const result = await runPracticeGenerationAfterResolve(admin, practiceInput, resolved, {
		useStreamObject: false,
		requestMode: "assignment_worker",
		recordGenerateClicked: false,
		persistGeneratedTest: async (input) => {
			const rpc = await admin.rpc("practice_generate_assigned_test", {
				p_student_id: row.studentId,
				p_assignment_submission_id: row.submissionId,
				p_subject_id: input.subjectId,
				p_difficulty: input.difficulty,
				p_duration_seconds: input.durationSeconds,
				p_question_count: input.questionCount,
				p_question_mix: input.questionMix,
				p_questions: input.questions,
			});
			if (rpc.error) {
				logSupabaseError("materializeAssignedPracticeTest.practice_generate_assigned_test", rpc.error, {
					assignmentSubmissionId: row.submissionId,
				});
			}
			return { data: (rpc.data as string | null) ?? null, error: rpc.error };
		},
	});

	if (!result.ok) {
		await markSubmissionGenerationFailed(row.submissionId, result.message);
		logServerError("materializeAssignedPracticeTest.generation_failed", new Error(result.message), {
			assignmentSubmissionId: row.submissionId,
			assignmentId: row.assignmentId,
			studentId: row.studentId,
		});
		return { ok: false, message: result.message };
	}

	await notifyAssignmentMaterialized({
		assignmentId: row.assignmentId,
		submissionId: row.submissionId,
		studentId: row.studentId,
		title: row.assignmentTitle,
	});

	return { ok: true, testId: result.testId };
}


async function materializeManualAssignedTest(args: {
	submissionId: string;
	studentId: string;
	assignmentId: string;
	assignmentTitle: string;
	subjectId: string;
}): Promise<AssignmentGenerationResult> {
	// Distinct authored topics -> ensure tracker rows exist first (mirrors the AI path),
	// so the post-grading tracker update has rows to update.
	const topicRows = await db
		.selectDistinct({ topicId: assignmentQuestions.topicId })
		.from(assignmentQuestions)
		.where(eq(assignmentQuestions.assignmentId, args.assignmentId));
	const topicIds = topicRows.map((r) => r.topicId);
	if (topicIds.length === 0) {
		const message = "Manual assignment has no questions.";
		await markSubmissionGenerationFailed(args.submissionId, message);
		return { ok: false, message };
	}
	await ensurePerformanceTrackerRowsForAssignmentTopics(args.studentId, args.subjectId, topicIds);

	const admin = createServiceRoleClient();
	// The migration that defines this RPC is applied separately, so it is not yet in
	// the generated Supabase types. Cast the name; `error`/`data` remain well typed.
	const { data, error } = await admin.rpc("practice_create_manual_assigned_test" as never, {
		p_assignment_submission_id: args.submissionId,
	} as never);
	if (error) {
		logSupabaseError("materializeManualAssignedTest.practice_create_manual_assigned_test", error, {
			assignmentSubmissionId: args.submissionId,
		});
		await markSubmissionGenerationFailed(args.submissionId, error.message ?? "Manual materialization failed.");
		return { ok: false, message: error.message ?? "Manual materialization failed." };
	}
	const testId = (data as string | null) ?? null;
	if (!testId) {
		const message = "Manual materialization returned no test id.";
		await markSubmissionGenerationFailed(args.submissionId, message);
		return { ok: false, message };
	}

	await notifyAssignmentMaterialized({
		assignmentId: args.assignmentId,
		submissionId: args.submissionId,
		studentId: args.studentId,
		title: args.assignmentTitle,
	});

	return { ok: true, testId };
}
