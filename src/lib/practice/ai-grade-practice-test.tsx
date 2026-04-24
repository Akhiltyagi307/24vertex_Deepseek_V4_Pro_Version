import { renderToBuffer } from "@react-pdf/renderer";
import { generateObject } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
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
import { writeStudentAnswerRow } from "@/lib/practice/student-answer-write";
import { PracticeGradingPdfDocument } from "@/lib/student/practice-grading-pdf-document";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ServerSupabase = SupabaseClient;

const CHUNK_SIZE = 8;

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
): Promise<{ questions: GradedQuestionItem[] }> {
	const maxOutputTokens = Math.min(32_000, Math.max(4_000, nQuestions * 1_200));
	return withPracticeAiAttempts("gradePracticeTest.chunk", async () => {
		const { object } = await generateObject({
			model: getOpenAIProvider()(getOpenAIChatModel()),
			schema: gradingChunkSchema,
			system: systemPrompt,
			prompt: userPrompt,
			maxOutputTokens,
			maxRetries: 2,
			providerOptions: {
				openai: { strictJsonSchema: false },
			},
		});
		return { questions: object.questions };
	});
}

async function runSummaryObject(stats: {
	overallPercent: number;
	topicLines: string[];
	nCorrect: number;
	nPartial: number;
	nIncorrect: number;
}): Promise<PracticeGradingSummary> {
	const prompt = [
		"You write concise student-facing summaries for a graded practice test.",
		"Use plain language. No markdown.",
		`Overall percent (mean of question scores): ${stats.overallPercent.toFixed(1)}`,
		`Counts — correct: ${stats.nCorrect}, partially correct: ${stats.nPartial}, incorrect: ${stats.nIncorrect}`,
		"Topics:",
		...stats.topicLines.map((l) => ` - ${l}`),
	].join("\n");

	return withPracticeAiAttempts("gradePracticeTest.summary", async () => {
		const { object } = await generateObject({
			model: getOpenAIProvider()(getOpenAIChatModel()),
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
		return object;
	});
}

/**
 * Loads the submitted practice test, runs full-test AI grading, persists rows, updates trackers,
 * renders PDF, uploads to storage, and sets tests.status = graded.
 */
export async function gradePracticeTestWithAi(
	supabase: ServerSupabase,
	userId: string,
	testId: string,
	elapsedSeconds: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { data: testRow, error: testErr } = await supabase
		.from("tests")
		.select(
			"id, student_id, subject_id, difficulty, time_limit_seconds, test_date, created_at, total_questions",
		)
		.eq("id", testId)
		.maybeSingle();

	if (testErr || !testRow || testRow.student_id !== userId) {
		return { ok: false, message: "Could not load test." };
	}

	const subjectId = testRow.subject_id as string;

	const { data: subjectRow } = await supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle();
	const subjectName = String(subjectRow?.name ?? "Subject").trim() || "Subject";
	const subjectLower = subjectName.toLowerCase();
	const requireMathSteps = subjectLower.includes("math");

	// answer_key is blocked from the authenticated role by column-level grant;
	// use the service-role client for the grading read path.
	const admin = createServiceRoleClient();
	const { data: questions, error: qErr } = await admin
		.from("questions")
		.select(
			"id, topic_id, question_text, question_type, answer_key, options, question_number, difficulty_level",
		)
		.eq("test_id", testId)
		.order("question_number", { ascending: true });

	if (qErr || !questions?.length) {
		return { ok: false, message: "Could not load questions." };
	}

	const topicIds = [...new Set(questions.map((q) => q.topic_id as string))];
	const { data: topicRows } = await supabase
		.from("topics")
		.select("id, topic_name, subject_id")
		.in("id", topicIds);

	const topicNameById = new Map((topicRows ?? []).map((t) => [t.id as string, String(t.topic_name)]));

	const { data: answerRows, error: aErr } = await supabase
		.from("student_answers")
		.select("question_id, student_answer")
		.eq("test_id", testId);

	if (aErr) {
		return { ok: false, message: "Could not load answers." };
	}

	const answerByQ = new Map((answerRows ?? []).map((r) => [r.question_id as string, r.student_answer]));

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

	const chunks = chunkArray(gradingInputs, CHUNK_SIZE);
	const merged: GradedQuestionItem[] = [];

	try {
		const tasks = chunks.map((part, ci) => async () => {
			const label = `part ${ci + 1} of ${chunks.length} (${part.length} questions)`;
			const userPrompt = buildPracticeGradingUserPrompt(label, part);
			const { questions: graded } = await runGradingChunk(systemPrompt, userPrompt, part.length);
			return graded;
		});
		const chunkResults = await pLimit(getGradingConcurrency(), tasks);
		for (const graded of chunkResults) {
			merged.push(...graded);
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : "AI grading failed.";
		logServerError("gradePracticeTestWithAi.runGradingChunk", e, { testId });
		return { ok: false, message: msg.length > 200 ? `${msg.slice(0, 200)}…` : msg };
	}

	const expectedIds = new Set(questions.map((q) => q.id as string));
	const seen = new Set<string>();
	for (const g of merged) {
		if (!expectedIds.has(g.question_id)) {
			return { ok: false, message: "AI returned an unknown question id." };
		}
		if (seen.has(g.question_id)) {
			return { ok: false, message: "Duplicate question in AI output." };
		}
		seen.add(g.question_id);
	}
	if (seen.size !== expectedIds.size) {
		return { ok: false, message: "AI did not return every question." };
	}

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
		const qMeta = questions.find((q) => q.id === g.question_id);
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
		summary = await runSummaryObject({
			overallPercent,
			topicLines: topicRollups.map(
				(t) =>
					`${t.topic_name}: avg ${t.average_score.toFixed(1)}% → ${t.status} (C${t.n_correct}/P${t.n_partial}/I${t.n_incorrect})`,
			),
			nCorrect,
			nPartial,
			nIncorrect,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Summary generation failed.";
		return { ok: false, message: msg };
	}

	const nowIso = new Date().toISOString();

	for (const g of merged) {
		const qRow = questions.find((x) => x.id === g.question_id)!;
		const qt = qRow.question_type as GradingQuestionInput["question_type"];
		const payload = answerByQ.get(g.question_id);
		const studentAnswer = payload ?? defaultStudentAnswerForQuestionType(qt);

		const { error: upErr } = await writeStudentAnswerRow(supabase, {
			test_id: testId,
			question_id: g.question_id,
			student_answer: studentAnswer,
			is_correct: verdictToIsCorrect(g.verdict),
			score_earned: g.score.toFixed(2),
			ai_feedback: buildAiFeedback(g),
			updated_at: nowIso,
		});

		if (upErr) {
			logSupabaseError("gradePracticeTestWithAi.student_answers.upsert", upErr, {
				testId,
				questionId: g.question_id,
			});
			return { ok: false, message: "Could not save graded answers." };
		}
	}

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

	const { error: repErr } = await supabase.from("test_reports").insert({
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
	});

	if (repErr) {
		logSupabaseError("gradePracticeTestWithAi.test_reports.insert", repErr, { testId });
		return { ok: false, message: "Could not save report." };
	}

	// Rolling-mean tracker update with trend recomputation lives in
	// practice_update_tracker_running (SECURITY DEFINER). Call per-topic.
	for (const row of topicRollups) {
		const { error: pe } = await supabase.rpc("practice_update_tracker_running", {
			p_student_id: userId,
			p_subject_id: subjectId,
			p_topic_id: row.topic_id,
			p_current_test_id: testId,
			p_current_test_score: row.average_score,
			p_current_n_incorrect: row.n_incorrect,
			p_now: nowIso,
		});
		if (pe) {
			logSupabaseError("gradePracticeTestWithAi.practice_update_tracker_running", pe, {
				testId,
				topicId: row.topic_id,
			});
		}
	}

	const totalScoreStr = overallPercent.toFixed(2);

	const { error: testUpErr } = await supabase
		.from("tests")
		.update({
			status: "graded",
			is_draft: false,
			duration_seconds: elapsedSeconds,
			correct_answers: nCorrect,
			total_score: totalScoreStr,
			total_questions: questions.length,
			updated_at: nowIso,
		})
		.eq("id", testId)
		.eq("student_id", userId);

	if (testUpErr) {
		return { ok: false, message: "Could not finalize test." };
	}

	return { ok: true };
}

/**
 * Renders the graded report to PDF and uploads it to Supabase Storage.
 * Called from the `pdf` background job after grading completes so a slow
 * render doesn't block the student's redirect to their report.
 */
export async function renderAndUploadPracticeReportPdf(
	testId: string,
): Promise<{ ok: true; storagePath: string } | { ok: false; message: string }> {
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

	const { data: subjectRow } = await admin.from("subjects").select("name").eq("id", subjectId).maybeSingle();
	const subjectName = String(subjectRow?.name ?? "Subject").trim() || "Subject";

	const { data: report, error: repErr } = await admin
		.from("test_reports")
		.select("summary_report")
		.eq("test_id", testId)
		.maybeSingle();
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

	const { data: questionRows, error: qErr } = await admin
		.from("questions")
		.select("id, topic_id, question_text, question_type, question_number")
		.eq("test_id", testId)
		.order("question_number", { ascending: true });
	if (qErr || !questionRows?.length) {
		return { ok: false, message: "Could not load questions." };
	}

	const { data: answerRows, error: aErr } = await admin
		.from("student_answers")
		.select("question_id, score_earned, is_correct, ai_feedback")
		.eq("test_id", testId);
	if (aErr) {
		return { ok: false, message: "Could not load answers." };
	}

	const topicIds = [...new Set(questionRows.map((q) => q.topic_id as string))];
	const { data: topicRows } = await admin
		.from("topics")
		.select("id, topic_name")
		.in("id", topicIds);
	const topicNameById = new Map((topicRows ?? []).map((t) => [t.id as string, String(t.topic_name)]));
	const topicNamesForCover = [
		...new Set(questionRows.map((q) => topicNameById.get(q.topic_id as string) ?? "Topic")),
	];

	const answerByQ = new Map(
		(answerRows ?? []).map((r) => [r.question_id as string, r]),
	);

	const pdfQuestions = questionRows.map((q) => {
		const a = answerByQ.get(q.id as string);
		const scoreStr = (a?.score_earned as string | null) ?? "0";
		const scoreNum = Number.parseFloat(scoreStr);
		const verdict: GradedQuestionItem["verdict"] =
			a?.is_correct === true ? "correct"
			: scoreNum > 0 && scoreNum < 100 ? "partially_correct"
			: "incorrect";
		const aiText = (a?.ai_feedback as string | null) ?? "";
		const [analysis, stepsMarker] = aiText.split("\n\nStep-by-step:\n");
		return {
			question_id: q.id as string,
			topic_id: q.topic_id as string,
			topic_name: topicNameById.get(q.topic_id as string) ?? "Topic",
			verdict,
			score: Number.isFinite(scoreNum) ? scoreNum : 0,
			analysis: analysis ?? aiText,
			step_by_step_solution: stepsMarker ?? undefined,
			user_answer_summary: "",
			reference_answer_summary: "",
			question_number: q.question_number as number,
			question_text: q.question_text as string,
			question_type: q.question_type as string,
		};
	});

	const overallPercent = Number(
		summaryPayload?.overall_percent ?? pdfQuestions.reduce((s, q) => s + q.score, 0) / Math.max(1, pdfQuestions.length),
	);

	try {
		const buffer = await renderToBuffer(
			<PracticeGradingPdfDocument
				subjectName={subjectName}
				difficulty={(testRow.difficulty as string | null) ?? null}
				timeLimitSeconds={testRow.time_limit_seconds as number | null}
				durationSeconds={(testRow.duration_seconds as number | null) ?? null}
				testDateIso={testRow.test_date as string | null}
				createdAtIso={testRow.created_at as string | null}
				topicNames={topicNamesForCover}
				totalQuestions={questionRows.length}
				overallScorePercent={overallPercent}
				overallSummary={summary.overall_summary}
				questions={pdfQuestions}
			/>,
		);

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

		await admin.from("test_reports").update({ pdf_storage_path: storagePath }).eq("test_id", testId);
		return { ok: true, storagePath };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "PDF render failed.";
		logServerError("renderAndUploadPracticeReportPdf.renderToBuffer", e, { testId });
		return { ok: false, message: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg };
	}
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
	const { data: existing } = await supabase.from("test_reports").select("id").eq("test_id", testId).maybeSingle();
	if (existing) return;

	const nowIso = new Date().toISOString();
	const { error } = await supabase.from("test_reports").insert({
		test_id: testId,
		student_id: userId,
		summary_report: { grading_failed: true, message, at: nowIso },
		strengths: null,
		improvement_areas: null,
		ai_insights: null,
		topic_performance: null,
		recommendations: null,
		pdf_storage_path: null,
		grading_failed_at: nowIso,
		grading_error: message.slice(0, 2000),
	});
	if (error) {
		logSupabaseError("recordGradingFailure.test_reports.insert", error, { testId });
	}
}
