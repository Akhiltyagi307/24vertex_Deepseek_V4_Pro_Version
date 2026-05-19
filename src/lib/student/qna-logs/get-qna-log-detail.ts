import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { stringifyStudentAnswer } from "@/lib/practice/grading-prompts";
import { formatGenerationAnswerForPdf } from "@/lib/student/practice-pdf-answer-key-display";
import { parseStoredQuestionVisualFromMetadata } from "@/lib/practice/visuals/parse-stored";

import { practiceAnswerKeySchema } from "@/lib/practice/generation-schema";

import { qnaLogPerformanceFromScore, qnaLogScorePercent } from "./qna-log-performance";
import type { QnaLogDetail, QnaLogQuestionType } from "./types";

type RawDetailRow = {
	answer_id: string;
	question_id: string;
	test_id: string;
	question_number: number;
	question_text: string;
	question_type: string;
	difficulty_level: string | null;
	options: unknown;
	answer_key: unknown;
	metadata: unknown;
	student_answer: unknown;
	score_earned: string | number | null;
	is_correct: boolean | null;
	ai_feedback: string | null;
	ai_user_answer_summary: string | null;
	ai_reference_answer_summary: string | null;
	test_date: Date | string | null;
	created_at: Date | string | null;
	test_type: string | null;
	test_status: "submitted" | "graded";
	subject_id: string | null;
	subject_name: string | null;
	topic_name: string | null;
	chapter_name: string | null;
};

function asIso(value: Date | string | null): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function parseQuestionType(value: string): QnaLogQuestionType {
	if (
		value === "multiple_choice" ||
		value === "fill_in_blank" ||
		value === "short_answer" ||
		value === "long_answer" ||
		value === "numerical"
	) {
		return value;
	}
	return "short_answer";
}

function parseOptions(value: unknown): Record<string, string> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(value)) {
		if (typeof v === "string") out[k] = v;
	}
	return Object.keys(out).length > 0 ? out : null;
}

function extractStudentSelectedKey(questionType: QnaLogQuestionType, payload: unknown): string | null {
	if (questionType !== "multiple_choice") return null;
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
	const o = payload as Record<string, unknown>;
	if (o.kind !== "mcq" || typeof o.value !== "string") return null;
	const key = o.value.trim().toUpperCase();
	return key.length > 0 ? key : null;
}

function extractCorrectOptionKey(questionType: QnaLogQuestionType, answerKey: unknown): string | null {
	if (questionType !== "multiple_choice") return null;
	const parsed = practiceAnswerKeySchema.safeParse(answerKey);
	if (!parsed.success) return null;
	const key = parsed.data.correct_answer.trim().toUpperCase();
	return key.length > 0 ? key : null;
}

function parseAiFeedback(text: string | null): { analysis: string; stepByStep: string | null } | null {
	const raw = text?.trim();
	if (!raw) return null;
	const [analysisPart, stepPart] = raw.split("\n\nStep-by-step:\n");
	const analysis = (analysisPart ?? raw).trim();
	const stepByStep = stepPart?.trim() ? stepPart.trim() : null;
	return { analysis, stepByStep };
}

export async function getQnaLogDetail(args: {
	studentId: string;
	answerId: string;
}): Promise<QnaLogDetail | null> {
	const rows = await db.execute(sql`
		SELECT
			sa.id AS answer_id,
			sa.question_id,
			sa.test_id,
			sa.student_answer,
			sa.score_earned,
			sa.is_correct,
			sa.ai_feedback,
			sa.ai_user_answer_summary,
			sa.ai_reference_answer_summary,
			q.question_number,
			q.question_text,
			q.question_type,
			q.difficulty_level,
			q.options,
			q.answer_key,
			q.metadata,
			t.test_date,
			t.created_at,
			t.test_type,
			t.status AS test_status,
			s.id AS subject_id,
			s.name AS subject_name,
			tp.topic_name,
			tp.chapter_name
		FROM student_answers sa
		JOIN tests t ON t.id = sa.test_id
		JOIN questions q ON q.id = sa.question_id
		LEFT JOIN subjects s ON s.id = t.subject_id
		LEFT JOIN topics tp ON tp.id = q.topic_id
		WHERE sa.id = ${args.answerId}
			AND t.student_id = ${args.studentId}
			AND t.is_draft IS NOT TRUE
			AND t.status IN ('submitted', 'graded')
		LIMIT 1
	`);

	const row = (rows as unknown as RawDetailRow[])[0];
	if (!row) return null;

	const questionType = parseQuestionType(String(row.question_type ?? "short_answer"));
	const options = parseOptions(row.options);
	const status = row.test_status === "submitted" ? "submitted" : "graded";
	const refSummary = row.ai_reference_answer_summary?.trim() || null;

	const fallbackCorrectAnswer =
		status === "graded"
			? formatGenerationAnswerForPdf({
					questionType,
					options,
					answerKeyJson: row.answer_key,
				})
			: null;

	const visualParse = parseStoredQuestionVisualFromMetadata(row.metadata);
	const feedback = parseAiFeedback(row.ai_feedback ?? null);
	const source = row.test_type === "assigned" ? "assignment" : "practice";

	return {
		answerId: String(row.answer_id),
		questionId: String(row.question_id),
		testId: String(row.test_id),
		questionNumber: Number(row.question_number ?? 0),
		questionText: String(row.question_text ?? ""),
		questionType,
		difficultyLevel: row.difficulty_level?.trim() ? row.difficulty_level : null,
		dateIso: asIso(row.test_date) ?? asIso(row.created_at),
		source,
		testStatus: status,
		performance: qnaLogPerformanceFromScore(status, row.score_earned),
		scorePercent: qnaLogScorePercent(row.score_earned),
		subjectId: row.subject_id ? String(row.subject_id) : "",
		subjectName: row.subject_name?.trim() ? row.subject_name : "Unknown subject",
		topicName: row.topic_name?.trim() ? row.topic_name : "—",
		chapterName: row.chapter_name?.trim() ? row.chapter_name : null,
		options,
		studentAnswerDisplay: stringifyStudentAnswer(row.student_answer),
		studentSelectedKey: extractStudentSelectedKey(questionType, row.student_answer),
		correctOptionKey: status === "graded" ? extractCorrectOptionKey(questionType, row.answer_key) : null,
		correctAnswerDisplay: status === "graded" ? (refSummary ?? fallbackCorrectAnswer ?? "—") : null,
		correctAnswerSummary: refSummary,
		aiFeedback: feedback,
		aiUserAnswerSummary: row.ai_user_answer_summary?.trim() || null,
		aiReferenceAnswerSummary: refSummary,
		visual: visualParse.ok ? visualParse.envelope : null,
	};
}
