import "server-only";

import { resolvePracticeConfigForStudent } from "@/lib/practice";
import { runPracticeGenerationAfterResolve } from "@/lib/practice/practice-generation-pipeline";
import type { FinalizePracticeConfigInput } from "@/lib/practice/schemas";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type StudentGenerationResult = { ok: true; testId: string } | { ok: false; message: string };

/**
 * Background generator for a student-initiated practice test (review finding H2 —
 * durable generation, increment 2b). Mirrors materializeReviewPracticeTest: runs
 * the practice pipeline under a service-role client for an explicit student and
 * persists via practice_generate_self_test (test_type='self', idempotent on
 * client_request_id). Invoked by the run-jobs worker for `student_generate_test`.
 *
 * Billing: the pipeline's internal consume/refund work here because
 * billing_consume_test / billing_refund_test key off p_profile_id (no auth.uid),
 * so the student is charged exactly as on the sync path — except this path is
 * durable (survives the 300s ceiling + client disconnect) and idempotent.
 */
export async function materializeStudentGeneratedTest(args: {
	studentId: string;
	clientRequestId: string;
	input: FinalizePracticeConfigInput;
}): Promise<StudentGenerationResult> {
	const { studentId, clientRequestId, input } = args;
	const admin = createServiceRoleClient();

	// Reclaim-idempotency: if a test already exists for this key, a prior run that
	// is now being reclaimed already generated + persisted (and charged) it. Skip
	// the whole pipeline so a reclaim cannot double-charge or duplicate.
	const { data: existing } = await admin
		.from("tests")
		.select("id")
		.eq("student_id", studentId)
		.eq("client_request_id", clientRequestId)
		.maybeSingle<{ id: string }>();
	if (existing?.id) return { ok: true, testId: existing.id };

	const resolved = await resolvePracticeConfigForStudent(admin, input, { id: studentId });
	if (!resolved.ok) return { ok: false, message: resolved.message };

	const result = await runPracticeGenerationAfterResolve(admin, input, resolved, {
		useStreamObject: false,
		// Link the run to the job key so the progress poller can find it by key.
		correlationId: clientRequestId,
		// requestMode intentionally omitted -> defaults to 'server_action', the one
		// non-stream value the practice_generation_runs.request_mode CHECK allows, so
		// the run + step telemetry actually persists for the progress poller. (The
		// *_worker modes in the type are rejected by that CHECK and silently drop.)
		recordGenerateClicked: false,
		persistGeneratedTest: async (persistInput) => {
			const rpc = await admin.rpc("practice_generate_self_test", {
				p_student_id: studentId,
				p_subject_id: persistInput.subjectId,
				p_difficulty: persistInput.difficulty,
				p_duration_seconds: persistInput.durationSeconds,
				p_question_count: persistInput.questionCount,
				p_question_mix: persistInput.questionMix,
				p_questions: persistInput.questions,
				p_client_request_id: clientRequestId,
			});
			if (rpc.error) {
				logSupabaseError("materializeStudentGeneratedTest.practice_generate_self_test", rpc.error, {
					studentId,
				});
			}
			return { data: (rpc.data as string | null) ?? null, error: rpc.error };
		},
	});

	if (!result.ok) {
		logServerError("materializeStudentGeneratedTest.generation_failed", new Error(result.message), {
			studentId,
		});
		return { ok: false, message: result.message };
	}
	return { ok: true, testId: result.testId };
}
