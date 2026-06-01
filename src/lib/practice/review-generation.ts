import "server-only";

import { insertInAppNotification } from "@/lib/notifications/insert";
import { resolvePracticeConfigForStudent } from "@/lib/practice";
import { runPracticeGenerationAfterResolve } from "@/lib/practice/practice-generation-pipeline";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type ReviewGenerationResult = { ok: true; testId: string } | { ok: false; message: string };

/**
 * Background generator for a spaced-repetition "review" test (Phase 2).
 * Mirrors materializeAssignedPracticeTest: runs the practice pipeline under a
 * service-role client for an explicit student, biased to the due weak topic,
 * persists via practice_generate_review_test (test_type='review'), and nudges
 * the student. Invoked by the run-jobs worker (review_generate job).
 */
export async function materializeReviewPracticeTest(args: {
	studentId: string;
	subjectId: string;
	topicId: string;
	trackerId: string;
}): Promise<ReviewGenerationResult> {
	const { studentId, subjectId, topicId, trackerId } = args;
	const admin = createServiceRoleClient();

	const practiceInput = {
		subjectId,
		trackerIds: [trackerId],
		difficulty: "medium" as const,
		durationSeconds: 3600 as const,
		focusArea: "recent_errors" as const,
	};

	const resolved = await resolvePracticeConfigForStudent(admin, practiceInput, { id: studentId });
	if (!resolved.ok) return { ok: false, message: resolved.message };

	const result = await runPracticeGenerationAfterResolve(admin, practiceInput, resolved, {
		useStreamObject: false,
		requestMode: "review_worker",
		recordGenerateClicked: false,
		persistGeneratedTest: async (input) => {
			const rpc = await admin.rpc("practice_generate_review_test", {
				p_student_id: studentId,
				p_subject_id: input.subjectId,
				p_difficulty: input.difficulty,
				p_duration_seconds: input.durationSeconds,
				p_question_count: input.questionCount,
				p_question_mix: input.questionMix,
				p_questions: input.questions,
			});
			if (rpc.error) {
				logSupabaseError("materializeReviewPracticeTest.practice_generate_review_test", rpc.error, {
					studentId,
					topicId,
				});
			}
			return { data: (rpc.data as string | null) ?? null, error: rpc.error };
		},
	});

	if (!result.ok) {
		logServerError("materializeReviewPracticeTest.generation_failed", new Error(result.message), {
			studentId,
			subjectId,
			topicId,
		});
		return { ok: false, message: result.message };
	}

	await insertInAppNotification({
		recipientId: studentId,
		title: "Time for a quick review",
		body: "A short review test is ready on a topic worth strengthening.",
		type: "reminder",
		category: "review_ready",
		referenceType: "test",
		referenceId: result.testId,
	});

	return { ok: true, testId: result.testId };
}
