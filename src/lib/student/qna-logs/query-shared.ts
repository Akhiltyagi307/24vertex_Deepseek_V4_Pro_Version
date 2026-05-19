import { sql, type SQL } from "drizzle-orm";

import { qnaDateKeyRangeToIso } from "./qna-log-query-params";
import type { QnaLogFilters, QnaLogSort } from "./types";

const sortDateExpr = sql`COALESCE(t.test_date, t.created_at)`;

export const qnaPerformanceCaseSql = sql<string>`
	CASE
		WHEN t.status = 'submitted' OR sa.score_earned IS NULL THEN 'pending'
		WHEN (sa.score_earned)::numeric >= 85 THEN 'correct'
		WHEN (sa.score_earned)::numeric >= 25 THEN 'partial'
		ELSE 'incorrect'
	END
`;

const qnaPerformanceRankSql = sql<number>`
	CASE
		WHEN t.status = 'submitted' OR sa.score_earned IS NULL THEN 0
		WHEN (sa.score_earned)::numeric >= 85 THEN 3
		WHEN (sa.score_earned)::numeric >= 25 THEN 2
		ELSE 1
	END
`;

function escapeLikeQuery(input: string): string {
	return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function buildQnaLogWhereSql(studentId: string, filters: QnaLogFilters): SQL {
	const whereParts: SQL[] = [
		sql`t.student_id = ${studentId}`,
		sql`t.is_draft IS NOT TRUE`,
		sql`t.status IN ('submitted', 'graded')`,
	];

	if (filters.subjectId) {
		whereParts.push(sql`t.subject_id = ${filters.subjectId}`);
	}
	if (filters.source === "practice") {
		whereParts.push(sql`t.test_type = 'self'`);
	} else if (filters.source === "assignment") {
		whereParts.push(sql`t.test_type = 'assigned'`);
	}
	if (filters.questionType) {
		whereParts.push(sql`q.question_type = ${filters.questionType}`);
	}
	if (filters.performance) {
		switch (filters.performance) {
			case "pending":
				whereParts.push(sql`(t.status = 'submitted' OR sa.score_earned IS NULL)`);
				break;
			case "correct":
				whereParts.push(sql`
					t.status = 'graded'
					AND sa.score_earned IS NOT NULL
					AND (sa.score_earned)::numeric >= 85
				`);
				break;
			case "partial":
				whereParts.push(sql`
					t.status = 'graded'
					AND sa.score_earned IS NOT NULL
					AND (sa.score_earned)::numeric >= 25
					AND (sa.score_earned)::numeric < 85
				`);
				break;
			case "incorrect":
				whereParts.push(sql`
					t.status = 'graded'
					AND sa.score_earned IS NOT NULL
					AND (sa.score_earned)::numeric < 25
				`);
				break;
		}
	}

	if (filters.query) {
		const pattern = `%${escapeLikeQuery(filters.query)}%`;
		whereParts.push(sql`
			(
				q.question_text ILIKE ${pattern} ESCAPE '\\'
				OR tp.topic_name ILIKE ${pattern} ESCAPE '\\'
				OR tp.chapter_name ILIKE ${pattern} ESCAPE '\\'
			)
		`);
	}

	const { startIso, endIso } = qnaDateKeyRangeToIso(filters.fromDateKey, filters.toDateKey);
	if (startIso) whereParts.push(sql`${sortDateExpr} >= ${startIso}`);
	if (endIso) whereParts.push(sql`${sortDateExpr} <= ${endIso}`);

	return sql`WHERE ${sql.join(whereParts, sql` AND `)}`;
}

type BuiltOrderSql = { windowOrder: SQL; orderBy: SQL };

function buildWindowOrderSql(sort: QnaLogSort): SQL {
	const isAsc = sort.dir === "asc";
	switch (sort.key) {
		case "subject":
			return isAsc
				? sql`s.sort_order ASC, s.name ASC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`
				: sql`s.sort_order DESC, s.name DESC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`;
		case "performance":
			return isAsc
				? sql`${qnaPerformanceRankSql} ASC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`
				: sql`${qnaPerformanceRankSql} DESC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`;
		case "type":
			return isAsc
				? sql`q.question_type ASC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`
				: sql`q.question_type DESC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`;
		case "topic":
			return isAsc
				? sql`COALESCE(tp.topic_name, '') ASC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`
				: sql`COALESCE(tp.topic_name, '') DESC, ${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`;
		case "date":
		default:
			return isAsc
				? sql`${sortDateExpr} ASC, q.question_number ASC, sa.id ASC`
				: sql`${sortDateExpr} DESC, q.question_number ASC, sa.id ASC`;
	}
}

export function buildQnaLogOrderSql(sort: QnaLogSort): BuiltOrderSql {
	const windowOrder = buildWindowOrderSql(sort);
	return { windowOrder, orderBy: sql`ORDER BY ${windowOrder}` };
}
