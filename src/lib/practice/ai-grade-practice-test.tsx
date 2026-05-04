import fs from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import { generateObject } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { consumeTest } from "@/lib/billing/entitlements";
import { notifyTestReportReady } from "@/lib/notifications/report-ready";
import { getOpenAIChatModel } from "@/lib/env";
import {
	buildPracticeGradingSystemPrompt,
	buildPracticeGradingUserPrompt,
	stringifyStudentAnswer,
	type GradingQuestionInput,
} from "@/lib/practice/grading-prompts";
import {
	gradingChunkSchema,
	practiceGradingSummarySchema,
	type GradedQuestionItem,
	type PracticeGradingSummary,
} from "@/lib/practice/grading-schema";
import { pLimit, withPracticeAiAttempts } from "@/lib/practice/ai-retry";
import { buildTopicRollups, type TopicRollupRow } from "@/lib/practice/topic-rollup";
import {
	formatScoreEarnedForDb,
	isPostgrestMissingColumnError,
	writeStudentAnswerRows,
	type StudentAnswerWriteRow,
} from "@/lib/practice/student-answer-write";
import { formatGenerationAnswerForPdf } from "@/lib/student/practice-pdf-answer-key-display";
import { PracticeGradingPdfDocument } from "@/lib/student/practice-grading-pdf-document";
import { createPhaseTimer, logPracticeObs, newPracticeCorrelationId } from "@/lib/server/practice-observability";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { withPracticeSpan } from "@/lib/practice/sentry-tags";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ServerSupabase = SupabaseClient;

function resolvePracticePdfLogoPath(): string | null {
	const logoPath = path.join(process.cwd(), "public", "brand", "logo-icon.png");
	try {
		if (fs.existsSync(logoPath)) return logoPath;
	} catch {
		/* ignore */
	}
	return null;
}

// 5 questions per grading call keeps each chunk's output budget under ~6k
// tokens (≈1.2k per question payload). Smaller chunks also mean a stuck or
// timing-out chunk fails one batch instead of a third of the test.
const CHUNK_SIZE = 5;

function getGradingConcurrency(): number {
	const raw = process.env.PRACTICE_WORKER_CONCURRENCY;
	const n = raw ? Number.parseInt(raw, 10) : NaN;
	if (!Number.isFinite(n) || n < 1) return 3;
	return Math.min(6, n);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		out.push(arr.slice(i, i + size));
	}
	return out;
}

function verdictToIsCorrect(v: GradedQuestionItem["verdict"]): boolean | null {
	if (v === "correct") return true;
	if (v === "incorrect") return false;
	return null;
}

function buildAiFeedback(g: GradedQuestionItem): string {
	const parts = [g.analysis.trim()];
	if (g.step_by_step_solution?.trim()) {
		parts.push(`\n\nStep-by-step:\n${g.step_by_step_solution.trim()}`);
	}
	return parts.filter(Boolean).join("");
}

function defaultStudentAnswerForQuestionType(
	t:
		| "multiple_choice"
		| "short_answer"
		| "numerical"
		| "fill_in_blank"
		| "long_answer",
): { kind: "mcq"; value: string } | { kind: "text"; value: string } | { kind: "numerical"; value: string } {
	if (t === "multiple_choice") return { kind: "mcq", value: "" };
	if (t === "numerical") return { kind: "numerical", value: "" };
	return { kind: "text", value: "" };
}

async function runGradingChunk(
	systemPrompt: string,
	userPrompt: string,
	nQuestions: number,
	userId: string,
): Promise<{ questions: GradedQuestionItem[] }> {
	// Hard-cap output tokens at 12k. CHUNK_SIZE=5 means at most ~6k expected
	// tokens per chunk (~1.2k per question grading payload), well within budget.
	const maxOutputTokens = Math.min(12_000, Math.max(4_000, nQuestions * 1_200));
	const modelId = getOpenAIChatModel();
	return withPracticeAiAttempts("gradePracticeTest.chunk", async () => {
		const t0 = Date.now();
		const { object, usage } = await generateObject({
			model: getOpenAIProvider()(modelId),
			schema: gradingChunkSchema,
			system: systemPrompt,
			prompt: userPrompt,
			maxOutputTokens,
			maxRetries: 2,
			providerOptions: {
				openai: { strictJsonSchema: false },
			},
		});
		void recordAiCall({
			feature: "practice.grade.chunk",
			model: modelId,
			userId,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});
		return { questions: object.questions };
	});
}

async function runSummaryObject(
	stats: {
		overallPercent: number;
		topicLines: string[];
		nCorrect: number;
		nPartial: number;
		nIncorrect: number;
	},
	userId: string,
): Promise<PracticeGradingSummary> {
	const prompt = [
		"You write concise student-facing summaries for a graded practice test.",
		"Use plain language. No markdown.",
		`Overall percent (mean of question scores): ${stats.overallPercent.toFixed(1)}`,
		`Counts — correct: ${stats.nCorrect}, partially correct: ${stats.nPartial}, incorrect: ${stats.nIncorrect}`,
		"Topics:",
		...stats.topicLines.map((l) => ` - ${l}`),
	].join("\n");

	return withPracticeAiAttempts("gradePracticeTest.summary", async () => {
		const t0 = Date.now();
		const modelId = getOpenAIChatModel();
		const { object, usage } = await generateObject({
			model: getOpenAIProvider()(modelId),
			schema: practiceGradingSummarySchema,
			system:
				"Return structured summary fields only. strengths, improvement_areas, and recommendations should be short bullet phrases (each array item one bullet).",
			prompt,
			maxOutputTokens: 2_000,
			maxRetries: 2,
			providerOptions: {
				openai: { strictJsonSchema: false },
			},
		});
		void recordAiCall({
			feature: "practice.grade.summary",
			model: modelId,
			userId,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});
		return object;
	});
}

/**
 * Loads the submitted practice test, runs full-test AI grading, persists rows, updates trackers,
 * renders PDF, uploads to storage, and sets tests.status = graded.
 *
 * Always uses the service-role client for reads and writes: the grader must read `answer_key` and
 * other tables regardless of the caller’s JWT, and a failed run may leave a `test_reports` failure
 * row that a retry must **upsert** over (insert-only would hit unique on `test_id`).
 *
 * Optional `workerContext.jobId` is attached to server logs when invoked from the background worker.
 */
export async function gradePracticeTestWithAi(
	userId: string,
	testId: string,
	elapsedSeconds: number,
	workerContext?: { jobId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
	const correlationId = newPracticeCorrelationId();
	const ctx: { correlationId: string; jobId?: string } = {
		correlationId,
		jobId: workerContext?.jobId,
	};
	return withPracticeSpan(
		"grade_practice_test",
		{
			test_id: testId,
			job_id: ctx.jobId ?? "",
			correlation_id: correlationId,
		},
		() => gradePracticeTestWithAiInner(userId, testId, elapsedSeconds, ctx),
	);
}

async function gradePracticeTestWithAiInner(
	userId: string,
	testId: string,
	elapsedSeconds: number,
	ctx: { correlationId: string; jobId?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
	const trace = {
		correlationId: ctx.correlationId,
		testId,
		jobId: ctx.jobId ?? null,
		started: Date.now(),
		timingsMs: {} as Record<string, number>,
		chunks: { count: 0, maxChunkMs: 0, totalChunkMs: 0 },
		questionCount: 0,
		ok: false,
	};
	const mark = createPhaseTimer(trace.started);

	try {
	const supabase = createServiceRoleClient();
	const logFail = (reason: string, message: string) => {
		logServerError(`gradePracticeTestWithAi.${reason}`, new Error(message), {
			testId,
			jobId: ctx.jobId,
			correlationId: ctx.correlationId,
		});
	};

	const { data: testRow, error: testErr } = await supabase
		.from("tests")
		.select(
			"id, student_id, subject_id, difficulty, time_limit_seconds, test_date, created_at, total_questions",
		)
		.eq("id", testId)
		.eq("student_id", userId)
		.maybeSingle();

	if (testErr || !testRow) {
		if (testErr) {
			logSupabaseError("gradePracticeTestWithAi.tests.select", testErr, {
				testId,
				correlationId: ctx.correlationId,
			});
		} else {
			logFail("testRowMissing", "Could not load test.");
		}
		return { ok: false, message: "Could not load test." };
	}

	const subjectId = testRow.subject_id as string;

	const [subjectRes, questionsRes, answersRes] = await Promise.all([
		supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
		supabase
			.from("questions")
			.select(
				"id, topic_id, question_text, question_type, answer_key, options, question_number, difficulty_level",
			)
			.eq("test_id", testId)
			.order("question_number", { ascending: true }),
		supabase.from("student_answers").select("question_id, student_answer").eq("test_id", testId),
	]);

	const { data: subjectRow } = subjectRes;
	const subjectName = String(subjectRow?.name ?? "Subject").trim() || "Subject";
	const subjectLower = subjectName.toLowerCase();
	const requireMathSteps = subjectLower.includes("math");

	const { data: questions, error: qErr } = questionsRes;
	if (qErr || !questions?.length) {
		if (qErr) {
			logSupabaseError("gradePracticeTestWithAi.questions.select", qErr, {
				testId,
				correlationId: ctx.correlationId,
			});
		} else {
			logFail("questionsEmpty", "Could not load questions.");
		}
		return { ok: false, message: "Could not load questions." };
	}

	trace.questionCount = questions.length;

	const topicIds = [
		...new Set(questions.map((q) => q.topic_id as string | null).filter((id): id is string => Boolean(id))),
	];
	const { data: topicRows } =
		topicIds.length > 0
			? await supabase.from("topics").select("id, topic_name, subject_id").in("id", topicIds)
			: { data: [] as { id: string; topic_name: string; subject_id: string }[] };

	const topicNameById = new Map((topicRows ?? []).map((t) => [t.id as string, String(t.topic_name)]));

	const { data: answerRows, error: aErr } = answersRes;
	if (aErr) {
		logSupabaseError("gradePracticeTestWithAi.student_answers.select", aErr, {
			testId,
			correlationId: ctx.correlationId,
		});
		return { ok: false, message: "Could not load answers." };
	}

	const answerByQ = new Map((answerRows ?? []).map((r) => [r.question_id as string, r.student_answer]));
	const questionById = new Map(questions.map((q) => [q.id as string, q]));

	const gradingInputs: GradingQuestionInput[] = questions.map((q) => {
		const raw = answerByQ.get(q.id as string) ?? null;
		return {
			question_id: q.id as string,
			topic_id: q.topic_id as string,
			topic_name: topicNameById.get(q.topic_id as string) ?? "Topic",
			question_number: q.question_number as number,
			question_type: q.question_type as GradingQuestionInput["question_type"],
			question_text: q.question_text as string,
			options: (q.options as Record<string, string> | null) ?? null,
			answer_key: q.answer_key,
			student_answer_raw: raw,
			student_answer_text: stringifyStudentAnswer(raw),
		};
	});

	const systemPrompt = buildPracticeGradingSystemPrompt({ subjectName, requireMathSteps });

	trace.timingsMs.loadData = mark();

	const chunks = chunkArray(gradingInputs, CHUNK_SIZE);
	trace.chunks.count = chunks.length;
	const merged: GradedQuestionItem[] = [];

	try {
		const tasks = chunks.map((part, ci) => async () => {
			const c0 = Date.now();
			const label = `part ${ci + 1} of ${chunks.length} (${part.length} questions)`;
			const userPrompt = buildPracticeGradingUserPrompt(label, part);
			const { questions: graded } = await runGradingChunk(systemPrompt, userPrompt, part.length, userId);
			const chunkMs = Date.now() - c0;
			trace.chunks.totalChunkMs += chunkMs;
			if (chunkMs > trace.chunks.maxChunkMs) trace.chunks.maxChunkMs = chunkMs;
			return graded;
		});
		const chunkResults = await pLimit(getGradingConcurrency(), tasks);
		for (const graded of chunkResults) {
			merged.push(...graded);
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : "AI grading failed.";
		logServerError("gradePracticeTestWithAi.runGradingChunk", e, {
			testId,
			correlationId: ctx.correlationId,
		});
		return { ok: false, message: msg.length > 200 ? `${msg.slice(0, 200)}…` : msg };
	}

	trace.timingsMs.aiChunks = mark();

	const expectedIds = new Set(questions.map((q) => q.id as string));
	const seen = new Set<string>();
	for (const g of merged) {
		if (!expectedIds.has(g.question_id)) {
			logFail("validationUnknownQ", "AI returned an unknown question id.");
			return { ok: false, message: "AI returned an unknown question id." };
		}
		if (seen.has(g.question_id)) {
			logFail("validationDuplicateQ", "Duplicate question in AI output.");
			return { ok: false, message: "Duplicate question in AI output." };
		}
		seen.add(g.question_id);
	}
	if (seen.size !== expectedIds.size) {
		logFail("validationIncompleteQ", "AI did not return every question.");
		return { ok: false, message: "AI did not return every question." };
	}

	trace.timingsMs.validateMerge = mark();

	const byTopic = new Map<
		string,
		{
			topic_name: string;
			scores: number[];
			verdicts: Array<"correct" | "partially_correct" | "incorrect">;
			question_ids: string[];
		}
	>();

	for (const g of merged) {
		const qMeta = questionById.get(g.question_id);
		const tid = (qMeta?.topic_id as string) ?? g.topic_id;
		const tname = topicNameById.get(tid) ?? "Topic";
		if (!byTopic.has(tid)) {
			byTopic.set(tid, { topic_name: tname, scores: [], verdicts: [], question_ids: [] });
		}
		const bucket = byTopic.get(tid)!;
		bucket.scores.push(g.score);
		bucket.verdicts.push(g.verdict);
		bucket.question_ids.push(g.question_id);
	}

	const topicRollups: TopicRollupRow[] = buildTopicRollups(byTopic);
	const overallPercent =
		merged.length > 0 ? merged.reduce((s, g) => s + g.score, 0) / merged.length : 0;

	let nCorrect = 0;
	let nPartial = 0;
	let nIncorrect = 0;
	for (const g of merged) {
		if (g.verdict === "correct") nCorrect++;
		else if (g.verdict === "partially_correct") nPartial++;
		else nIncorrect++;
	}

	let summary: PracticeGradingSummary;
	try {
		summary = await runSummaryObject(
			{
				overallPercent,
				topicLines: topicRollups.map(
					(t) =>
						`${t.topic_name}: avg ${t.average_score.toFixed(1)}% → ${t.status} (C${t.n_correct}/P${t.n_partial}/I${t.n_incorrect})`,
				),
				nCorrect,
				nPartial,
				nIncorrect,
			},
			userId,
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Summary generation failed.";
		logServerError("gradePracticeTestWithAi.runSummaryObject", e, {
			testId,
			jobId: ctx.jobId,
			correlationId: ctx.correlationId,
		});
		return { ok: false, message: msg };
	}

	trace.timingsMs.aiSummary = mark();

	const nowIso = new Date().toISOString();

	const gradedRows: StudentAnswerWriteRow[] = merged.map((g) => {
		const qRow = questionById.get(g.question_id)!;
		const qt = qRow.question_type as GradingQuestionInput["question_type"];
		const payload = answerByQ.get(g.question_id);
		const studentAnswer = payload ?? defaultStudentAnswerForQuestionType(qt);
		return {
			test_id: testId,
			question_id: g.question_id,
			student_answer: studentAnswer,
			is_correct: verdictToIsCorrect(g.verdict),
			score_earned: formatScoreEarnedForDb(g.score),
			ai_feedback: buildAiFeedback(g),
			ai_user_answer_summary: g.user_answer_summary?.trim() || null,
			ai_reference_answer_summary: g.reference_answer_summary?.trim() || null,
			updated_at: nowIso,
		};
	});

	const { error: batchAnswerErr } = await writeStudentAnswerRows(supabase, gradedRows);
	if (batchAnswerErr) {
		logSupabaseError("gradePracticeTestWithAi.student_answers.upsert", batchAnswerErr, {
			testId,
			correlationId: ctx.correlationId,
		});
		logFail("studentAnswersSave", "Could not save graded answers.");
		return { ok: false, message: "Could not save graded answers." };
	}

	trace.timingsMs.persistAnswers = mark();

	const topicPerformancePayload = {
		schema_version: 1 as const,
		topics: topicRollups,
	};

	const summaryReportPayload = {
		schema_version: 1 as const,
		overall_percent: overallPercent,
		graded_at: nowIso,
		summary: summary,
	};

	const { error: repErr } = await supabase.from("test_reports").upsert(
		{
			test_id: testId,
			student_id: userId,
			summary_report: summaryReportPayload,
			strengths: summary.strengths,
			improvement_areas: summary.improvement_areas,
			ai_insights: summary.ai_insights,
			topic_performance: topicPerformancePayload,
			recommendations: summary.recommendations,
			pdf_storage_path: null,
			grading_failed_at: null,
			grading_error: null,
		},
		{ onConflict: "test_id" },
	);

	if (repErr) {
		logSupabaseError("gradePracticeTestWithAi.test_reports.upsert", repErr, {
			testId,
			correlationId: ctx.correlationId,
		});
		logFail("testReportsSave", "Could not save report.");
		return { ok: false, message: "Could not save report." };
	}

	trace.timingsMs.testReports = mark();

	// Fire-and-forget: in-app "report ready" (emails go after PDF upload + signed URL).
	void notifyTestReportReady({
		studentId: userId,
		testId,
		subjectName,
		overallPercent,
	});

	if (topicRollups.length > 0) {
		const { error: bulkTrackerErr } = await supabase.rpc("practice_update_trackers_bulk", {
			p_student_id: userId,
			p_subject_id: subjectId,
			p_current_test_id: testId,
			p_now: nowIso,
			p_items: topicRollups.map((row) => ({
				topic_id: row.topic_id,
				average_score: row.average_score,
				n_incorrect: row.n_incorrect,
			})),
		});
		if (bulkTrackerErr) {
			logSupabaseError("gradePracticeTestWithAi.practice_update_trackers_bulk", bulkTrackerErr, {
				testId,
				correlationId: ctx.correlationId,
				topicItems: topicRollups.length,
			});
		}
	}

	trace.timingsMs.trackersBulk = mark();

	const totalScoreStr = formatScoreEarnedForDb(overallPercent);

	const billingAfter = await consumeTest(supabase, userId);
	if (!billingAfter.ok) {
		logServerError("gradePracticeTestWithAi.consumeTest", new Error(billingAfter.message), {
			testId,
			jobId: ctx.jobId,
			correlationId: ctx.correlationId,
			code: billingAfter.code,
		});
		return { ok: false, message: billingAfter.message };
	}

	const { error: testUpErr } = await supabase
		.from("tests")
		.update({
			status: "graded",
			is_draft: false,
			// PDR: reports and `practice_update_tracker_running` use this as the
			// test’s place in time; set at completion, not only at row creation.
			test_date: nowIso,
			duration_seconds: elapsedSeconds,
			correct_answers: nCorrect,
			total_score: totalScoreStr,
			total_questions: questions.length,
			updated_at: nowIso,
		})
		.eq("id", testId)
		.eq("student_id", userId);

	if (testUpErr) {
		logSupabaseError("gradePracticeTestWithAi.tests.update", testUpErr, {
			testId,
			correlationId: ctx.correlationId,
		});
		logFail("testsFinalize", "Could not finalize test.");
		return { ok: false, message: "Could not finalize test." };
	}

	trace.timingsMs.finalizeTest = mark();
	trace.ok = true;
	return { ok: true };
	} finally {
		logPracticeObs({
			phase: "grade_pipeline",
			correlationId: trace.correlationId,
			testId: trace.testId,
			jobId: trace.jobId,
			ok: trace.ok,
			durationMs: Date.now() - trace.started,
			timingsMs: trace.timingsMs,
			chunkCount: trace.chunks.count,
			maxChunkMs: trace.chunks.maxChunkMs,
			totalChunkMs: trace.chunks.totalChunkMs,
			questionCount: trace.questionCount > 0 ? trace.questionCount : undefined,
		});
	}
}

export type BuildPracticeGradingReportPdfResult =
	| { ok: true; buffer: Buffer; userId: string; subjectName: string; overallPercent: number | null }
	| { ok: false; message: string };

/**
 * Renders the full practice grading PDF (branded, per-question detail) to a buffer.
 * Used by the background upload job and by the student report PDF route when storage has no file yet.
 */
export async function buildPracticeGradingReportPdfBuffer(
	testId: string,
): Promise<BuildPracticeGradingReportPdfResult> {
	const admin = createServiceRoleClient();

	const { data: testRow, error: testErr } = await admin
		.from("tests")
		.select(
			"id, student_id, subject_id, difficulty, time_limit_seconds, test_date, created_at, total_questions, duration_seconds",
		)
		.eq("id", testId)
		.maybeSingle();
	if (testErr || !testRow) {
		return { ok: false, message: "Could not load test row." };
	}

	const userId = testRow.student_id as string;
	const subjectId = testRow.subject_id as string;

	const [subjectRes, reportRes, profileRes, questionsRes] = await Promise.all([
		admin.from("subjects").select("name").eq("id", subjectId).maybeSingle(),
		admin.from("test_reports").select("summary_report, topic_performance").eq("test_id", testId).maybeSingle(),
		admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
		admin
			.from("questions")
			.select("id, topic_id, question_text, question_type, question_number, difficulty_level, options, answer_key")
			.eq("test_id", testId)
			.order("question_number", { ascending: true }),
	]);

	const subjectName = String(subjectRes.data?.name ?? "Subject").trim() || "Subject";

	const { data: report, error: repErr } = reportRes;
	if (repErr || !report?.summary_report) {
		return { ok: false, message: "No graded report to render." };
	}
	const summaryPayload = report.summary_report as {
		summary?: PracticeGradingSummary;
		overall_percent?: number;
	} | null;
	const summary = summaryPayload?.summary;
	if (!summary) {
		return { ok: false, message: "Report is missing summary data." };
	}

	const studentDisplayName = String(profileRes.data?.full_name ?? "").trim() || null;

	const { data: questionRows, error: qErr } = questionsRes;
	if (qErr || !questionRows?.length) {
		return { ok: false, message: "Could not load questions." };
	}

	const answerSelectFull =
		"question_id, score_earned, is_correct, ai_feedback, student_answer, ai_user_answer_summary, ai_reference_answer_summary";
	const answerSelectBase =
		"question_id, score_earned, is_correct, ai_feedback, student_answer";

	type PdfAnswerRow = {
		question_id: string;
		score_earned: unknown;
		is_correct: unknown;
		ai_feedback: unknown;
		student_answer: unknown;
		ai_user_answer_summary?: unknown;
		ai_reference_answer_summary?: unknown;
	};

	const topicIds = [...new Set(questionRows.map((q) => q.topic_id as string))];
	const topicsPromise =
		topicIds.length > 0 ?
			admin.from("topics").select("id, topic_name, chapter_name, unit_name, grade").in("id", topicIds)
		:	Promise.resolve({
				data: [] as Array<{
					id: string;
					topic_name: string;
					chapter_name: string | null;
					unit_name: string | null;
					grade: unknown;
				}>,
				error: null,
			});

	const [res1, topicRes] = await Promise.all([
		admin.from("student_answers").select(answerSelectFull).eq("test_id", testId),
		topicsPromise,
	]);
	let answerRows = res1.data as PdfAnswerRow[] | null;
	let aErr = res1.error;
	const topicRows = topicRes.data;
	if (aErr && isPostgrestMissingColumnError(aErr)) {
		const res2 = await admin.from("student_answers").select(answerSelectBase).eq("test_id", testId);
		answerRows = res2.data as PdfAnswerRow[] | null;
		aErr = res2.error;
	}
	if (aErr) {
		return { ok: false, message: "Could not load answers." };
	}

	const topicNameById = new Map((topicRows ?? []).map((t) => [t.id as string, String(t.topic_name)]));
	const chapterNameById = new Map(
		(topicRows ?? []).map((t) => [t.id as string, String(t.chapter_name ?? "").trim() || "—"]),
	);
	const unitNameById = new Map(
		(topicRows ?? []).map((t) => [t.id as string, String(t.unit_name ?? "").trim() || ""]),
	);
	const topicGradeById = new Map(
		(topicRows ?? []).map((t) => {
			const g = t.grade;
			return [t.id as string, typeof g === "number" ? g : null] as const;
		}),
	);

	type TopicPerf = { topic_id: string; topic_name: string; average_score: number; status: string };
	const perfTopics =
		(report.topic_performance as { topics?: TopicPerf[] } | null)?.topics?.length ?
			((report.topic_performance as { topics: TopicPerf[] }).topics)
		:	[];

	const perfByTopicId = new Map(perfTopics.map((t) => [t.topic_id, t] as const));

	const topicIdOrder: string[] = [];
	const seenTopic = new Set<string>();
	for (const q of questionRows) {
		const tid = q.topic_id as string;
		if (!seenTopic.has(tid)) {
			seenTopic.add(tid);
			topicIdOrder.push(tid);
		}
	}
	const topicCoverageRows = topicIdOrder.map((tid) => {
		const p = perfByTopicId.get(tid);
		return {
			chapterName: chapterNameById.get(tid) ?? "—",
			topicName: topicNameById.get(tid) ?? "Topic",
			unitName: unitNameById.get(tid) || null,
			grade: topicGradeById.get(tid) ?? null,
			averageScore: p != null ? p.average_score : null,
			statusLabel: p != null ? p.status : "—",
		};
	});

	const answerByQ = new Map(
		(answerRows ?? []).map((r) => [r.question_id as string, r]),
	);

	const pdfQuestions = questionRows.map((q) => {
		const a = answerByQ.get(q.id as string);
		const scoreStr = (a?.score_earned as string | null) ?? "0";
		const scoreNum = Number.parseFloat(String(scoreStr));
		const verdict: GradedQuestionItem["verdict"] =
			a?.is_correct === true ? "correct"
			: scoreNum > 0 && scoreNum < 100 ? "partially_correct"
			: "incorrect";
		const aiText = (a?.ai_feedback as string | null) ?? "";
		const [analysis, stepsMarker] = aiText.split("\n\nStep-by-step:\n");
		const userSummary = a?.ai_user_answer_summary as string | null | undefined;
		const refSummary = a?.ai_reference_answer_summary as string | null | undefined;
		const rawAnswer = a?.student_answer ?? null;
		const optionsRaw = q.options as Record<string, string> | null | undefined;
		const generationDisplay = formatGenerationAnswerForPdf({
			questionType: String(q.question_type),
			options: optionsRaw ?? null,
			answerKeyJson: q.answer_key,
		});
		return {
			question_id: q.id as string,
			topic_id: q.topic_id as string,
			topic_name: topicNameById.get(q.topic_id as string) ?? "Topic",
			chapter_name: chapterNameById.get(q.topic_id as string) ?? "—",
			unit_name: unitNameById.get(q.topic_id as string) || null,
			grade: topicGradeById.get(q.topic_id as string) ?? null,
			verdict,
			score: Number.isFinite(scoreNum) ? scoreNum : 0,
			analysis: (analysis ?? aiText).trim(),
			step_by_step_solution: stepsMarker?.trim() ? stepsMarker.trim() : undefined,
			user_answer_summary: (userSummary ?? "").trim(),
			reference_answer_summary: (refSummary ?? "").trim(),
			student_answer_display: stringifyStudentAnswer(rawAnswer),
			question_number: q.question_number as number,
			question_text: q.question_text as string,
			question_type: q.question_type as string,
			question_difficulty: (q.difficulty_level as string | null | undefined) ?? null,
			generation_answer_display: generationDisplay,
		};
	});

	const overallPercent = Number(
		summaryPayload?.overall_percent ?? pdfQuestions.reduce((s, q) => s + q.score, 0) / Math.max(1, pdfQuestions.length),
	);

	const logoSrc = resolvePracticePdfLogoPath();

	try {
		const raw = await renderToBuffer(
			<PracticeGradingPdfDocument
				subjectName={subjectName}
				studentDisplayName={studentDisplayName}
				difficulty={(testRow.difficulty as string | null) ?? null}
				timeLimitSeconds={testRow.time_limit_seconds as number | null}
				durationSeconds={(testRow.duration_seconds as number | null) ?? null}
				testDateIso={testRow.test_date as string | null}
				createdAtIso={testRow.created_at as string | null}
				topicCoverageRows={topicCoverageRows}
				totalQuestions={questionRows.length}
				overallScorePercent={overallPercent}
				summary={summary}
				logoSrc={logoSrc}
				questions={pdfQuestions}
			/>,
		);
		const buffer = raw instanceof Buffer ? raw : Buffer.from(raw);
		const overallPercentOut = Number.isFinite(overallPercent) ? overallPercent : null;
		return { ok: true, buffer, userId, subjectName, overallPercent: overallPercentOut };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "PDF render failed.";
		logServerError("buildPracticeGradingReportPdfBuffer.renderToBuffer", e, { testId });
		return { ok: false, message: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg };
	}
}

/**
 * Uploads a rendered practice report PDF to Storage and sets `test_reports.pdf_storage_path`.
 */
export async function uploadPracticeGradingReportPdf(
	userId: string,
	testId: string,
	buffer: Buffer,
): Promise<{ ok: true; storagePath: string } | { ok: false; message: string }> {
	const admin = createServiceRoleClient();
	const storagePath = `${userId}/${testId}.pdf`;
	const { error: upStorage } = await admin.storage
		.from("student-test-reports")
		.upload(storagePath, buffer, {
			contentType: "application/pdf",
			upsert: true,
		});

	if (upStorage) {
		return { ok: false, message: upStorage.message ?? "Storage upload failed." };
	}

	const { error: upRow } = await admin.from("test_reports").update({ pdf_storage_path: storagePath }).eq("test_id", testId);
	if (upRow) {
		logSupabaseError("uploadPracticeGradingReportPdf.test_reports.update", upRow, { testId });
	}

	return { ok: true, storagePath };
}

/**
 * Renders the graded report to PDF and uploads it to Supabase Storage.
 * Called from the `pdf` background job after grading completes so a slow
 * render doesn't block the student's redirect to their report.
 */
export type RenderAndUploadPracticeReportPdfResult =
	| {
			ok: true;
			storagePath: string;
			studentId: string;
			subjectName: string;
			overallPercent: number | null;
	  }
	| { ok: false; message: string };

export async function renderAndUploadPracticeReportPdf(
	testId: string,
): Promise<RenderAndUploadPracticeReportPdfResult> {
	const built = await buildPracticeGradingReportPdfBuffer(testId);
	if (!built.ok) {
		return built;
	}
	const up = await uploadPracticeGradingReportPdf(built.userId, testId, built.buffer);
	if (!up.ok) {
		return up;
	}
	return {
		ok: true,
		storagePath: up.storagePath,
		studentId: built.userId,
		subjectName: built.subjectName,
		overallPercent: built.overallPercent,
	};
}

/**
 * Records a failed grading attempt for diagnostics (insert only if no report exists).
 */
export async function recordGradingFailure(
	supabase: ServerSupabase,
	userId: string,
	testId: string,
	message: string,
): Promise<void> {
	const nowIso = new Date().toISOString();
	const failureRow = {
		summary_report: { grading_failed: true, message, at: nowIso } as const,
		strengths: null as null,
		improvement_areas: null as null,
		ai_insights: null as null,
		topic_performance: null as null,
		recommendations: null as null,
		grading_failed_at: nowIso,
		grading_error: message.slice(0, 2000),
	};

	const { data: existing } = await supabase.from("test_reports").select("id").eq("test_id", testId).maybeSingle();
	const { error } = existing
		? await supabase
				.from("test_reports")
				.update(failureRow)
				.eq("test_id", testId)
				.eq("student_id", userId)
		: await supabase.from("test_reports").insert({
				test_id: testId,
				student_id: userId,
				...failureRow,
				pdf_storage_path: null,
			});
	if (error) {
		logSupabaseError(
			existing ? "recordGradingFailure.test_reports.update" : "recordGradingFailure.test_reports.insert",
			error,
			{ testId },
		);
	}
}
