import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { listQnaLogSubjectOptions } from "./list-qna-log-subject-options";
import { buildQnaLogOrderSql, buildQnaLogWhereSql, qnaPerformanceCaseSql } from "./query-shared";
import { qnaLogPerformanceFromScore, qnaLogScorePercent } from "./qna-log-performance";
import { truncateQuestionPreview } from "./truncate-question-preview";
import {
	QNA_LOG_QUESTION_TYPES,
	type QnaLogListParams,
	type QnaLogListResult,
	type QnaLogListRow,
	type QnaLogQuestionType,
} from "./types";

const questionTypeSet = new Set<string>(QNA_LOG_QUESTION_TYPES);

type RawListRow = {
	answer_id: string;
	question_id: string;
	test_id: string;
	question_number: number;
	question_preview_source: string | null;
	question_type: string;
	test_date: Date | string | null;
	created_at: Date | string | null;
	test_type: string | null;
	test_status: "submitted" | "graded";
	score_earned: string | number | null;
	subject_id: string | null;
	subject_name: string | null;
	subject_sort_order: number | null;
	topic_name: string | null;
	chapter_name: string | null;
	performance_bucket: "correct" | "partial" | "incorrect" | "pending";
	total: number;
};

function coerceQuestionType(value: string): QnaLogQuestionType {
	return questionTypeSet.has(value) ? (value as QnaLogQuestionType) : "short_answer";
}

function asIso(value: Date | string | null): string | null {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function listQnaLogRows(params: QnaLogListParams): Promise<QnaLogListResult> {
	const { studentId, page, pageSize, filters, sort } = params;
	const safePage = Math.max(1, page);

	const whereSql = buildQnaLogWhereSql(studentId, filters);
	const { orderBy } = buildQnaLogOrderSql(sort);

	const runRowsQuery = (pageToFetch: number) =>
		db.execute(sql`
			SELECT
				sa.id AS answer_id,
				sa.question_id,
				sa.test_id,
				q.question_number,
				LEFT(q.question_text, 120) AS question_preview_source,
				q.question_type,
				t.test_date,
				t.created_at,
				t.test_type,
				t.status AS test_status,
				sa.score_earned,
				s.id AS subject_id,
				s.name AS subject_name,
				s.sort_order AS subject_sort_order,
				tp.topic_name,
				tp.chapter_name,
				${qnaPerformanceCaseSql} AS performance_bucket,
				COUNT(*) OVER()::int AS total
			FROM tests t
			JOIN student_answers sa ON sa.test_id = t.id
			JOIN questions q ON q.id = sa.question_id
			LEFT JOIN subjects s ON s.id = t.subject_id
			LEFT JOIN topics tp ON tp.id = q.topic_id
			${whereSql}
			${orderBy}
			LIMIT ${pageSize}
			OFFSET ${(pageToFetch - 1) * pageSize}
		`);

	const [initialListRows, subjectOptions] = await Promise.all([
		runRowsQuery(safePage),
		listQnaLogSubjectOptions(studentId),
	]);

	const total = Number((initialListRows[0] as { total?: unknown } | undefined)?.total ?? 0);
	const maxPage = Math.max(1, Math.ceil((total || 1) / pageSize));
	const resolvedPage = Math.min(safePage, maxPage);
	const finalListRows =
		resolvedPage === safePage ? initialListRows : await runRowsQuery(resolvedPage);

	const rows = (finalListRows as unknown as RawListRow[]).map((row) => {
		const testStatus: QnaLogListRow["testStatus"] =
			row.test_status === "submitted" ? "submitted" : "graded";
		const source: QnaLogListRow["source"] =
			row.test_type === "assigned" ? "assignment" : "practice";
		const previewSource = row.question_preview_source ?? "";
		const scorePercent = qnaLogScorePercent(row.score_earned);
		return {
			answerId: String(row.answer_id),
			questionId: String(row.question_id),
			testId: String(row.test_id),
			questionNumber: Number(row.question_number ?? 0),
			questionPreview: truncateQuestionPreview(previewSource, 20),
			questionType: coerceQuestionType(String(row.question_type ?? "short_answer")),
			dateIso: asIso(row.test_date) ?? asIso(row.created_at),
			source,
			performance:
				row.performance_bucket ??
				qnaLogPerformanceFromScore(testStatus, row.score_earned),
			scorePercent,
			subjectId: row.subject_id ? String(row.subject_id) : "",
			subjectName: row.subject_name?.trim() ? row.subject_name : "Unknown subject",
			subjectSortOrder: Number(row.subject_sort_order ?? 0),
			topicName: row.topic_name?.trim() ? row.topic_name : "—",
			chapterName: row.chapter_name?.trim() ? row.chapter_name : null,
			testStatus,
		};
	});

	return {
		rows,
		total,
		page: resolvedPage,
		pageSize,
		subjectOptions,
	};
}
