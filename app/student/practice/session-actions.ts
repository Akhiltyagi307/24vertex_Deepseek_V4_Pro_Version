"use server";

import { generateObject } from "ai";
import { z } from "zod";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { triggerPracticeWorkerInBackground } from "@/lib/admin/practice-worker-trigger";
import { computeAssignedGradingRunAfter } from "@/lib/assignments/schemas";
import { canStartDoubtChat, consumeTokens } from "@/lib/billing/entitlements";
import { getOpenAIChatModel } from "@/lib/env";
import { practiceGenerationOutputSchema, validateAndStripGeneration } from "@/lib/practice";
import { consumeAdaptiveFollowupsRateLimit } from "@/lib/practice/practice-rate-limit";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
	assertTestOwnedByStudent,
	assertTestOwnedInProgress,
	executePracticeTestSubmit,
	redirectPathForExistingTestSubmission,
	writeStudentAnswerRow,
} from "@/lib/practice/submit-practice-shared";

const studentAnswerPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("mcq"), value: z.string().max(8) }),
	z.object({ kind: z.literal("text"), value: z.string().max(16_000) }),
	z.object({ kind: z.literal("numerical"), value: z.string().max(200) }),
]);

const upsertInputSchema = z.object({
	testId: z.string().uuid(),
	questionId: z.string().uuid(),
	studentAnswer: studentAnswerPayloadSchema,
	flaggedForReview: z.boolean().optional(),
	timeSpentMs: z.number().int().min(0).max(30 * 60_000).optional(),
	visits: z.number().int().min(0).max(10_000).optional(),
});

export type UpsertPracticeAnswerResult =
	| { ok: true }
	| { ok: false; message: string };

export type { SubmitPracticeTestResult } from "@/lib/practice/submit-practice-shared";

/** Avoid leaking Postgres/PostgREST details to the client UI. */
function friendlyDbError(context: "save" | "submit"): string {
	return context === "save" ?
			"We couldn’t save your answer. Wait a moment and try again, or refresh the page if this keeps happening."
		:	"We couldn’t submit your test. Wait a moment and try again, or refresh the page if this keeps happening.";
}

/**
 * Saves one answer (debounced from the client). Does not grade.
 */
export async function upsertPracticeAnswer(input: unknown): Promise<UpsertPracticeAnswerResult> {
	const parsed = upsertInputSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, message: "Invalid answer payload." };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, message: "Sign in to save answers." };
	}

	const gate = await assertTestOwnedInProgress(supabase, parsed.data.testId, user.id);
	if (!gate.ok) {
		return gate;
	}

	const { data: qRow, error: qErr } = await supabase
		.from("questions")
		.select("id, test_id, question_type")
		.eq("id", parsed.data.questionId)
		.eq("test_id", parsed.data.testId)
		.maybeSingle();

	if (qErr || !qRow) {
		return { ok: false, message: "Question not found." };
	}

	const expectedKind =
		qRow.question_type === "multiple_choice" ? "mcq"
		: qRow.question_type === "numerical" ? "numerical"
		: "text";

	if (parsed.data.studentAnswer.kind !== expectedKind) {
		return { ok: false, message: "Answer type does not match the question." };
	}

	const { error: upErr } = await writeStudentAnswerRow(supabase, {
		test_id: parsed.data.testId,
		question_id: parsed.data.questionId,
		student_answer: parsed.data.studentAnswer,
		flagged_for_review: parsed.data.flaggedForReview ?? false,
		time_spent_ms: parsed.data.timeSpentMs ?? null,
		visits: parsed.data.visits ?? null,
		updated_at: new Date().toISOString(),
	});

	if (upErr) {
		logSupabaseError("upsertPracticeAnswer.student_answers.upsert", upErr, {
			testId: parsed.data.testId,
			questionId: parsed.data.questionId,
		});
		return { ok: false, message: friendlyDbError("save") };
	}

	return { ok: true };
}

const submitInputSchema = z.object({
	testId: z.string().uuid(),
	elapsedSeconds: z.number().int().min(0).max(86400),
});

function syncGradingEnabled(): boolean {
	return process.env.PRACTICE_SYNC_GRADING === "true";
}

async function restorePracticeTestStatus(
	supabase: Awaited<ReturnType<typeof createClient>>,
	testId: string,
	status: "in_progress" | "grading" | "grading_failed",
	studentId: string,
) {
	const patch =
		status === "in_progress" ?
			{ status, duration_seconds: null, updated_at: new Date().toISOString() }
		:	{ status, updated_at: new Date().toISOString() };
	const { error } = await supabase
		.from("tests")
		.update(patch)
		.eq("id", testId)
		.eq("student_id", studentId);
	if (error) {
		logSupabaseError("restorePracticeTestStatus.tests.update", error, {
			testId,
			targetStatus: status,
		});
	}
}

/**
 * Marks the test as grading and enqueues a background job. In dev or with
 * PRACTICE_SYNC_GRADING=true, grading still runs synchronously (kill switch).
 */
export async function submitPracticeTest(
	input: unknown,
): Promise<{ ok: true; redirectTo: string } | { ok: false; message: string }> {
	const parsed = submitInputSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, message: "Invalid submit payload." };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, message: "Sign in to submit." };
	}

	const owned = await assertTestOwnedByStudent(supabase, parsed.data.testId, user.id, {
		status: ["in_progress", "grading", "grading_failed", "graded"],
	});
	if (!owned.ok) {
		return { ok: false, message: owned.message };
	}

	if (syncGradingEnabled()) {
		return executePracticeTestSubmit(supabase, user.id, parsed.data.testId, parsed.data.elapsedSeconds);
	}

	// Atomic: flips in_progress -> grading, records clamped duration.
	const { data, error } = await supabase.rpc("practice_start_grading", {
		p_test_id: parsed.data.testId,
		p_client_elapsed_seconds: parsed.data.elapsedSeconds,
	});

	if (error) {
		logSupabaseError("submitPracticeTest.practice_start_grading", error, {
			testId: parsed.data.testId,
		});
		return { ok: false, message: friendlyDbError("submit") };
	}

	type Row = { test_id: string; subject_id: string };
	const rows = (data ?? []) as Row[];
	if (rows.length === 0) {
		const { data: existing } = await supabase
			.from("tests")
			.select("subject_id, status")
			.eq("id", parsed.data.testId)
			.eq("student_id", user.id)
			.maybeSingle();
		return {
			ok: true,
			redirectTo: redirectPathForExistingTestSubmission(
				parsed.data.testId,
				existing?.subject_id as string | undefined,
				existing?.status as string | undefined,
			),
		};
	}

	const row = rows[0]!;
	const { data: testMeta } = await supabase
		.from("tests")
		.select("assignment_submission_id")
		.eq("id", row.test_id)
		.eq("student_id", user.id)
		.maybeSingle();
	const isAssignedTest = Boolean(testMeta?.assignment_submission_id);
	const gradeRunAfter =
		isAssignedTest ?
			computeAssignedGradingRunAfter(new Date(), user.id).toISOString()
		:	new Date().toISOString();

	// Enqueue grade job.
	const { error: enqErr } = await supabase.rpc("practice_enqueue_job", {
		p_job_type: "grade",
		p_test_id: row.test_id,
		p_payload: {},
		p_run_after: gradeRunAfter,
	});
	if (enqErr) {
		logSupabaseError("submitPracticeTest.practice_enqueue_job", enqErr, {
			testId: row.test_id,
			jobType: "grade",
		});
		await restorePracticeTestStatus(supabase, row.test_id, "in_progress", user.id);
		return { ok: false, message: friendlyDbError("submit") };
	}

	if (isAssignedTest && typeof testMeta?.assignment_submission_id === "string") {
		const admin = createServiceRoleClient();
		const submittedAt = new Date().toISOString();
		const { error: submissionErr } = await admin
			.from("assignment_submissions")
			.update({
				lifecycle_status: "grading",
				submitted_at: submittedAt,
				updated_at: submittedAt,
			})
			.eq("id", testMeta.assignment_submission_id)
			.eq("student_id", user.id);
		if (submissionErr) {
			logSupabaseError("submitPracticeTest.assignment_submissions.update", submissionErr, {
				testId: row.test_id,
				assignmentSubmissionId: testMeta.assignment_submission_id,
			});
		}
	}

	void triggerPracticeWorkerInBackground()
		.then((triggerResult) => {
			if (!triggerResult.ok) {
				logServerError("submitPracticeTest.triggerPracticeWorkerInBackground", triggerResult.message, {
					testId: row.test_id,
				});
			}
		})
		.catch((err) => {
			logServerError("submitPracticeTest.triggerPracticeWorkerInBackground", err, {
				testId: row.test_id,
			});
		});

	return {
		ok: true,
		redirectTo: `/student/practice/${row.test_id}/grading`,
	};
}

const retrySchema = z.object({ testId: z.string().uuid() });

/**
 * Re-enqueues a grade job for a test stuck in `grading_failed`. Student-only.
 */
export async function retryPracticeGrading(
	input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const parsed = retrySchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: "Invalid payload." };

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, message: "Sign in to retry grading." };

	const { data: test } = await supabase
		.from("tests")
		.select("id, student_id, status")
		.eq("id", parsed.data.testId)
		.maybeSingle();

	if (!test || test.student_id !== user.id) {
		return { ok: false, message: "Test not found." };
	}
	if (test.status !== "grading_failed" && test.status !== "grading") {
		return { ok: false, message: "This test is not in a failed grading state." };
	}

	const { error: flipErr } = await supabase
		.from("tests")
		.update({ status: "grading", updated_at: new Date().toISOString() })
		.eq("id", parsed.data.testId)
		.eq("student_id", user.id);
	if (flipErr) return { ok: false, message: friendlyDbError("submit") };

	const { error: enqErr } = await supabase.rpc("practice_enqueue_job", {
		p_job_type: "grade",
		p_test_id: parsed.data.testId,
		p_payload: { retry: true },
		p_run_after: new Date().toISOString(),
	});
	if (enqErr) {
		logSupabaseError("retryPracticeGrading.practice_enqueue_job", enqErr, {
			testId: parsed.data.testId,
			jobType: "grade",
		});
		await restorePracticeTestStatus(
			supabase,
			parsed.data.testId,
			test.status as "grading" | "grading_failed",
			user.id,
		);
		return { ok: false, message: friendlyDbError("submit") };
	}

	const triggerResult = await triggerPracticeWorkerInBackground();
	if (!triggerResult.ok) {
		logServerError("retryPracticeGrading.triggerPracticeWorkerInBackground", triggerResult.message, {
			testId: parsed.data.testId,
		});
	}
	return { ok: true };
}

const adaptiveInputSchema = z.object({
	testId: z.string().uuid(),
	/** Running score so far (0-100) so the generator can calibrate difficulty. */
	runningScore: z.number().min(0).max(100).optional(),
	count: z.number().int().min(1).max(10).optional(),
});

type AdaptiveSuccess = { ok: true; added: number };
type AdaptiveFailure = { ok: false; message: string };
export type AdaptiveFollowupsResult = AdaptiveSuccess | AdaptiveFailure;

/**
 * Phase 3: generate N follow-up questions for an in-progress test based on
 * the student's running performance. Gated by `PRACTICE_ADAPTIVE=true`.
 */
export async function appendAdaptiveFollowups(input: unknown): Promise<AdaptiveFollowupsResult> {
	if (process.env.PRACTICE_ADAPTIVE !== "true") {
		return { ok: false, message: "Adaptive follow-ups are disabled." };
	}

	const parsed = adaptiveInputSchema.safeParse(input);
	if (!parsed.success) return { ok: false, message: "Invalid payload." };

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false, message: "Sign in to continue." };

	const rateGate = await consumeAdaptiveFollowupsRateLimit(supabase);
	if (!rateGate.ok) {
		return { ok: false, message: rateGate.message };
	}

	const { data: test, error: tErr } = await supabase
		.from("tests")
		.select("id, student_id, subject_id, difficulty, status, question_count")
		.eq("id", parsed.data.testId)
		.maybeSingle();
	if (tErr || !test || test.student_id !== user.id) {
		return { ok: false, message: "Test not found." };
	}
	if (test.status !== "in_progress") {
		return { ok: false, message: "Test is not in progress." };
	}

	// AI-token entitlement gate. Adaptive follow-ups run a paid LLM call, so a
	// lapsed / out-of-tokens student must not be able to trigger generation just
	// because they still hold a rate-limit slot. canStartDoubtChat is the shared
	// "active subscription + AI tokens remaining" check (no-op when SaaS
	// enforcement is off); actual usage is debited below after generation.
	const aiGate = await canStartDoubtChat(supabase, user.id);
	if (!aiGate.ok) {
		return { ok: false, message: aiGate.message };
	}

	// Use the existing topics in this test to stay in scope. We additionally
	// filter to `is_active=true` here: the original test was generated against
	// active topics, but an admin may have soft-deleted one between test
	// creation and the student requesting adaptive follow-ups. Generating a
	// follow-up on an inactive topic would persist a question that students
	// can't legitimately practise on, and the admin's intent (to retire the
	// topic) would be silently undone.
	const admin = createServiceRoleClient();
	const { data: qRows, error: qErr } = await admin
		.from("questions")
		.select("topic_id")
		.eq("test_id", parsed.data.testId);
	if (qErr || !qRows?.length) {
		return { ok: false, message: "Could not load test topics." };
	}
	const allTopicIdsInTest = [...new Set(qRows.map((r) => r.topic_id as string))];

	const { data: topicRows } = await admin
		.from("topics")
		.select("id, topic_name")
		.in("id", allTopicIdsInTest)
		.eq("is_active", true);
	const activeTopicRows = topicRows ?? [];
	const topicIds = activeTopicRows.map((t) => t.id as string);
	if (topicIds.length === 0) {
		return {
			ok: false,
			message:
				"None of this test's topics are still active. Start a new test to continue with adaptive follow-ups.",
		};
	}
	const topicNameById = new Map(activeTopicRows.map((t) => [t.id as string, String(t.topic_name)]));

	const count = parsed.data.count ?? 5;
	const running = parsed.data.runningScore ?? 70;
	const targetDifficulty: "easy" | "medium" | "hard" =
		running >= 80 ? "hard" : running <= 40 ? "easy" : "medium";

	const systemPrompt = `You generate practice follow-up questions as strict JSON. The student is running at ${running.toFixed(
		0,
	)}% on their current practice test. Generate EXACTLY ${count} questions on the topics below, calibrated to ${targetDifficulty} difficulty. Use MCQ, short_answer, and numerical types (at least two). Every question's topic_id MUST match one of the provided topic_ids. MCQ answer_key.correct_answer must be a single letter A, B, C, or D mapped to the options. Output JSON only.`;

	const userPrompt = JSON.stringify(
		{
			intent: "generate_followups",
			difficulty: targetDifficulty,
			running_score_percent: running,
			count,
			topics: topicIds.map((tid) => ({ topic_id: tid, topic_name: topicNameById.get(tid) ?? "Topic" })),
		},
		null,
		2,
	);

	try {
		const t0 = Date.now();
		const { object, usage } = await generateObject({
			model: getOpenAIProvider()(getOpenAIChatModel()),
			schema: practiceGenerationOutputSchema,
			system: systemPrompt,
			prompt: userPrompt,
			maxOutputTokens: Math.min(12_000, count * 900),
			maxRetries: 2,
			// Bound the call so a hung provider connection can't keep this server
			// action (and its serverless invocation) alive indefinitely.
			abortSignal: AbortSignal.timeout(60_000),
			providerOptions: { openai: { strictJsonSchema: false } },
		});
		void recordAiCall({
			feature: "practice.adaptive_followups",
			model: getOpenAIChatModel(),
			userId: user.id,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});

		// Count this adaptive-generation call against the student's AI token
		// budget (output-token quota model — the same meter doubt-chat draws
		// down). No-op when SaaS enforcement is off.
		await consumeTokens(supabase, user.id, usage?.outputTokens ?? 0);

		const validation = validateAndStripGeneration(object, count, new Set(topicIds));
		if (!validation.ok) {
			return { ok: false, message: validation.message };
		}

		const payload = object.questions.map((q) => ({
			topic_id: q.topic_id,
			question_text: q.question_text,
			question_type: q.question_type,
			difficulty_level: q.difficulty_level,
			answer_key: q.answer_key,
			options: q.question_type === "multiple_choice" ? q.options : null,
			metadata: {},
		}));

		const { data: addedCount, error: appErr } = await supabase.rpc("practice_append_questions", {
			p_test_id: parsed.data.testId,
			p_questions: payload,
		});

		if (appErr) {
			logSupabaseError("appendAdaptiveFollowups.practice_append_questions", appErr);
			return { ok: false, message: "Could not append questions." };
		}

		return { ok: true, added: (addedCount as number) ?? payload.length };
	} catch (e) {
		logServerError("appendAdaptiveFollowups.generateObject", e, {
			testId: parsed.data.testId,
		});
		return { ok: false, message: "Follow-up generation failed." };
	}
}
