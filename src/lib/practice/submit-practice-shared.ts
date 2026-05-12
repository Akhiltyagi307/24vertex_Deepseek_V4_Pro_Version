import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import { notifyTestReportPdfReadyEmails, notifyTestReportReady } from "@/lib/notifications/report-ready";
import { gradePracticeTestWithAi, recordGradingFailure, renderAndUploadPracticeReportPdf } from "@/lib/practice/ai-grade-practice-test";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	writeStudentAnswerRow,
	writeStudentAnswerRows,
	type StudentAnswerWriteRow,
} from "@/lib/practice/student-answer-write";

export type { StudentAnswerWriteRow };
export { writeStudentAnswerRow, writeStudentAnswerRows };

export type SubmitPracticeTestResult =
	| { ok: true; redirectTo: string }
	| { ok: false; message: string };

/**
 * After `practice_start_grading` returned no row (idempotent/double submit), route by real `tests.status`
 * so we do not send students to the reports list while the attempt is still `grading`.
 */
export function redirectPathForExistingTestSubmission(
	testId: string,
	subjectId: string | undefined,
	status: string | undefined,
): string {
	if (status === "grading" || status === "grading_failed") {
		return `/student/practice/${testId}/grading`;
	}
	if (status === "graded" && subjectId) {
		return `/student/reports?subject=${encodeURIComponent(subjectId)}&test=${encodeURIComponent(testId)}`;
	}
	if (subjectId) {
		return `/student/reports?subject=${encodeURIComponent(subjectId)}`;
	}
	return "/student/reports";
}

function friendlyDbError(context: "save" | "submit"): string {
	return context === "save" ?
			"We couldn’t save your answer. Wait a moment and try again, or refresh the page if this keeps happening."
		:	"We couldn’t submit your test. Wait a moment and try again, or refresh the page if this keeps happening.";
}

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type AnswerKeyJson = {
	correct_answer: string;
};

/**
 * Compatibility shim retained for callers outside `executePracticeTestSubmit`.
 * New code should use the atomic `practice_start_grading` RPC instead.
 */
export async function assertTestOwnedInProgress(
	supabase: ServerSupabase,
	testId: string,
	studentId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: test, error } = await supabase
		.from("tests")
		.select("id, student_id, status")
		.eq("id", testId)
		.maybeSingle();

	if (error || !test) {
		return { ok: false, message: "Test not found." };
	}
	if (test.student_id !== studentId) {
		return { ok: false, message: "You do not have access to this test." };
	}
	if (test.status !== "in_progress") {
		return { ok: false, message: "This test is no longer in progress." };
	}
	return { ok: true };
}

/**
 * Phase 1: `validateAndStripGeneration` now enforces that stored answer keys
 * are already a single A–D letter, so this function only normalizes the
 * student's submitted letter. Anything that doesn't round-trip to one of A–D
 * is treated as no selection.
 */
function normalizeMcqLetter(raw: string): string {
	const candidate = raw.trim().toUpperCase();
	return /^[A-D]$/.test(candidate) ? candidate : "";
}

type StartGradingRow = {
	test_id: string;
	subject_id: string;
	status: string;
	duration_seconds: number | null;
	time_limit_seconds: number | null;
	started_at: string | null;
};

/**
 * Atomically flips tests.status from 'in_progress' to 'grading' via RPC.
 * Returns the frozen row on success, or a user-friendly error otherwise.
 */
async function startPracticeGrading(
	supabase: ServerSupabase,
	testId: string,
	elapsedSeconds: number,
): Promise<
	| { ok: true; row: StartGradingRow }
	| { ok: false; message: string; alreadySubmitted?: boolean }
> {
	const { data, error } = await supabase.rpc("practice_start_grading", {
		p_test_id: testId,
		p_client_elapsed_seconds: elapsedSeconds,
	});

	if (error) {
		logSupabaseError("startPracticeGrading.practice_start_grading", error, { testId });
		return { ok: false, message: friendlyDbError("submit") };
	}

	const rows = (data ?? []) as StartGradingRow[];
	if (rows.length === 0) {
		return {
			ok: false,
			alreadySubmitted: true,
			message: "This test has already been submitted.",
		};
	}
	return { ok: true, row: rows[0]! };
}

/** After status is already `grading`, avoid leaving the row stuck if we cannot finish the pipeline. */
async function failGradingInProgress(
	supabase: ServerSupabase,
	userId: string,
	testId: string,
	diagnostic: string,
): Promise<SubmitPracticeTestResult> {
	const { error } = await supabase
		.from("tests")
		.update({
			status: "grading_failed",
			is_draft: false,
			updated_at: new Date().toISOString(),
		})
		.eq("id", testId)
		.eq("student_id", userId);
	if (error) {
		logSupabaseError("failGradingInProgress.tests.update", error, { testId });
		return { ok: false, message: friendlyDbError("submit") };
	}
	await recordGradingFailure(supabase, userId, testId, diagnostic);
	return { ok: true, redirectTo: `/student/practice/${testId}/grading` };
}

/**
 * Marks the test as grading, performs fast MCQ scoring for the fallback path,
 * runs the AI grader, and finalizes the test status. Phase 1 keeps grading
 * synchronous; Phase 2 will move it to a background worker.
 */
export async function executePracticeTestSubmit(
	supabase: ServerSupabase,
	userId: string,
	testId: string,
	elapsedSeconds: number,
): Promise<SubmitPracticeTestResult> {
	const gate = await startPracticeGrading(supabase, testId, elapsedSeconds);
	if (!gate.ok) {
		if (gate.alreadySubmitted) {
			const { data: existing } = await supabase
				.from("tests")
				.select("subject_id, status")
				.eq("id", testId)
				.maybeSingle();
			return {
				ok: true,
				redirectTo: redirectPathForExistingTestSubmission(
					testId,
					existing?.subject_id as string | undefined,
					existing?.status as string | undefined,
				),
			};
		}
		return { ok: false, message: gate.message };
	}

	const clampedElapsed = gate.row.duration_seconds ?? elapsedSeconds;

	// Answer keys live behind a column-level GRANT that excludes the authenticated
	// role. Use the service-role client for reads that need them.
	const admin = createServiceRoleClient();

	const { data: questions, error: qErr } = await admin
		.from("questions")
		.select("id, question_type, answer_key")
		.eq("test_id", testId)
		.order("question_number", { ascending: true });

	if (qErr || !questions?.length) {
		return failGradingInProgress(
			supabase,
			userId,
			testId,
			qErr ? "Could not load questions for grading." : "No questions found for this test.",
		);
	}

	const { data: existingAnswers, error: aErr } = await supabase
		.from("student_answers")
		.select("question_id, student_answer")
		.eq("test_id", testId);

	if (aErr) {
		return failGradingInProgress(supabase, userId, testId, "Could not load your answers.");
	}

	const answerByQ = new Map(
		(existingAnswers ?? []).map((r) => [r.question_id as string, r.student_answer]),
	);

	let mcqTotal = 0;
	let mcqCorrect = 0;
	const mcqRows: StudentAnswerWriteRow[] = [];
	const nowIso = new Date().toISOString();

	for (const q of questions) {
		if (q.question_type !== "multiple_choice") {
			continue;
		}
		mcqTotal++;
		const keyRaw = (q.answer_key as AnswerKeyJson | null)?.correct_answer ?? "";
		const keyLetter = normalizeMcqLetter(keyRaw);

		const payload = answerByQ.get(q.id as string);
		let letter = "";
		if (
			payload &&
			typeof payload === "object" &&
			"kind" in payload &&
			payload.kind === "mcq" &&
			"value" in payload &&
			typeof (payload as { value: unknown }).value === "string"
		) {
			letter = normalizeMcqLetter((payload as { value: string }).value);
		}

		const ok = letter.length > 0 && letter === keyLetter;
		if (ok) {
			mcqCorrect++;
		}

		const studentAnswer =
			payload &&
			typeof payload === "object" &&
			"kind" in payload &&
			payload.kind === "mcq" ?
				(payload as { kind: "mcq"; value: string })
			:	{ kind: "mcq" as const, value: letter };

		mcqRows.push({
			test_id: testId,
			question_id: q.id as string,
			student_answer: studentAnswer,
			is_correct: ok,
			score_earned: ok ? "100" : "0",
			updated_at: nowIso,
		});
	}

	if (mcqRows.length > 0) {
		const { error: upErr } = await writeStudentAnswerRows(supabase, mcqRows);
		if (upErr) {
			logSupabaseError("executePracticeTestSubmit.student_answers.upsert", upErr, {
				testId,
			});
			return failGradingInProgress(supabase, userId, testId, "Could not save scored answers before AI grading.");
		}
	}

	const mcqOnlyTotalScoreStr = mcqTotal > 0 ? ((100 * mcqCorrect) / mcqTotal).toFixed(2) : null;

	const aiResult = await gradePracticeTestWithAi(userId, testId, clampedElapsed);
	if (!aiResult.ok) {
		const { error: testErr } = await supabase
			.from("tests")
			.update({
				status: "grading_failed",
				is_draft: false,
				duration_seconds: clampedElapsed,
				correct_answers: mcqCorrect,
				total_score: mcqOnlyTotalScoreStr,
				updated_at: new Date().toISOString(),
			})
			.eq("id", testId)
			.eq("student_id", userId);

		if (testErr) {
			return { ok: false, message: friendlyDbError("submit") };
		}

		await recordGradingFailure(supabase, userId, testId, aiResult.message);
		// Do not send the student to reports: this test is not `graded` yet. Same
		// handoff as the async worker path — grading UI with retry.
		return { ok: true, redirectTo: `/student/practice/${testId}/grading` };
	}

	const { error: pdfEnqErr } = await supabase.rpc("practice_enqueue_job", {
		p_job_type: "pdf",
		p_test_id: testId,
		p_payload: {},
		p_run_after: new Date().toISOString(),
	});
	if (pdfEnqErr) {
		logSupabaseError("executePracticeTestSubmit.practice_enqueue_job", pdfEnqErr, {
			testId,
			jobType: "pdf",
		});
		const pdfResult = await renderAndUploadPracticeReportPdf(testId);
		if (!pdfResult.ok) {
			logServerError(
				"executePracticeTestSubmit.renderAndUploadPracticeReportPdf",
				new Error(pdfResult.message),
				{ testId },
			);
		} else {
			try {
				await notifyTestReportReady({
					studentId: pdfResult.studentId,
					testId,
					subjectName: pdfResult.subjectName,
					overallPercent: pdfResult.overallPercent,
					submittedAtIso: pdfResult.submittedAtIso,
				});
			} catch (err) {
				logServerError("executePracticeTestSubmit.fallback_in_app_notify", err, {
					testId,
				});
			}
			void notifyTestReportPdfReadyEmails({
				testId,
				studentId: pdfResult.studentId,
				subjectName: pdfResult.subjectName,
				overallPercent: pdfResult.overallPercent,
				storagePath: pdfResult.storagePath,
			});
		}
	}

	const subjectId = gate.row.subject_id;
	const redirectTo = subjectId
		? `/student/reports?subject=${encodeURIComponent(subjectId)}`
		: "/student/reports";

	return { ok: true, redirectTo };
}
