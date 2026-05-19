import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";

import { buildQnaLogOrderSql, buildQnaLogWhereSql } from "./query-shared";
import type { QnaLogFilters, QnaLogSort } from "./types";

const sortDateExpr = sql`COALESCE(t.test_date, t.created_at)`;

type AnchorRow = {
	answer_id: string;
	sort_date: Date | string;
	question_number: number;
	subject_sort_order: number | null;
	subject_name: string | null;
	question_type: string;
	topic_name: string | null;
	performance_rank: number;
};

async function fetchAnchorRow(args: {
	studentId: string;
	answerId: string;
	filters: QnaLogFilters;
}): Promise<AnchorRow | null> {
	const whereSql = buildQnaLogWhereSql(args.studentId, args.filters);
	const rows = await db.execute(sql`
		SELECT
			sa.id AS answer_id,
			${sortDateExpr} AS sort_date,
			q.question_number,
			s.sort_order AS subject_sort_order,
			s.name AS subject_name,
			q.question_type,
			COALESCE(tp.topic_name, '') AS topic_name,
			CASE
				WHEN t.status = 'submitted' OR sa.score_earned IS NULL THEN 0
				WHEN (sa.score_earned)::numeric >= 85 THEN 3
				WHEN (sa.score_earned)::numeric >= 25 THEN 2
				ELSE 1
			END AS performance_rank
		FROM tests t
		JOIN student_answers sa ON sa.test_id = t.id
		JOIN questions q ON q.id = sa.question_id
		LEFT JOIN subjects s ON s.id = t.subject_id
		LEFT JOIN topics tp ON tp.id = q.topic_id
		${whereSql}
			AND sa.id = ${args.answerId}
		LIMIT 1
	`);

	const row = (rows as unknown as AnchorRow[])[0];
	return row ?? null;
}

function buildDateAdjacentSql(args: {
	anchor: AnchorRow;
	direction: "next" | "prev";
	sortDir: "asc" | "desc";
}): SQL {
	const anchorDate = args.anchor.sort_date;
	const anchorQn = args.anchor.question_number;
	const anchorId = args.anchor.answer_id;
	const wantsNext = args.direction === "next";
	const dateDesc = args.sortDir === "desc";

	// "Next" moves down the table in the current ORDER BY direction.
	const forward =
		dateDesc
			? wantsNext
			: !wantsNext;

	if (forward) {
		return sql`
			(
				${sortDateExpr} < ${anchorDate}
				OR (
					${sortDateExpr} = ${anchorDate}
					AND q.question_number > ${anchorQn}
				)
				OR (
					${sortDateExpr} = ${anchorDate}
					AND q.question_number = ${anchorQn}
					AND sa.id > ${anchorId}
				)
			)
		`;
	}

	return sql`
		(
			${sortDateExpr} > ${anchorDate}
			OR (
				${sortDateExpr} = ${anchorDate}
				AND q.question_number < ${anchorQn}
			)
			OR (
				${sortDateExpr} = ${anchorDate}
				AND q.question_number = ${anchorQn}
				AND sa.id < ${anchorId}
			)
		)
	`;
}

async function getAdjacentByKeyset(args: {
	studentId: string;
	anchor: AnchorRow;
	direction: "next" | "prev";
	filters: QnaLogFilters;
	sort: QnaLogSort;
}): Promise<string | null> {
	const whereSql = buildQnaLogWhereSql(args.studentId, args.filters);
	const { orderBy } = buildQnaLogOrderSql(args.sort);

	let adjacentPredicate: SQL | null = null;
	if (args.sort.key === "date") {
		adjacentPredicate = buildDateAdjacentSql({
			anchor: args.anchor,
			direction: args.direction,
			sortDir: args.sort.dir,
		});
	}

	if (!adjacentPredicate) return null;

	const rows = await db.execute(sql`
		SELECT sa.id AS answer_id
		FROM tests t
		JOIN student_answers sa ON sa.test_id = t.id
		JOIN questions q ON q.id = sa.question_id
		LEFT JOIN subjects s ON s.id = t.subject_id
		LEFT JOIN topics tp ON tp.id = q.topic_id
		${whereSql}
			AND ${adjacentPredicate}
		${orderBy}
		LIMIT 1
	`);

	const row = rows[0] as { answer_id?: unknown } | undefined;
	return row?.answer_id ? String(row.answer_id) : null;
}

async function getAdjacentByWindow(args: {
	studentId: string;
	currentAnswerId: string;
	direction: "next" | "prev";
	filters: QnaLogFilters;
	sort: QnaLogSort;
}): Promise<string | null> {
	const whereSql = buildQnaLogWhereSql(args.studentId, args.filters);
	const { windowOrder } = buildQnaLogOrderSql(args.sort);
	const delta = args.direction === "next" ? 1 : -1;

	const rows = await db.execute(sql`
		WITH filtered AS (
			SELECT
				sa.id AS answer_id,
				ROW_NUMBER() OVER (ORDER BY ${windowOrder}) AS rn
			FROM tests t
			JOIN student_answers sa ON sa.test_id = t.id
			JOIN questions q ON q.id = sa.question_id
			LEFT JOIN subjects s ON s.id = t.subject_id
			LEFT JOIN topics tp ON tp.id = q.topic_id
			${whereSql}
		),
		anchor AS (
			SELECT rn
			FROM filtered
			WHERE answer_id = ${args.currentAnswerId}
			LIMIT 1
		)
		SELECT f.answer_id
		FROM filtered f
		JOIN anchor a ON TRUE
		WHERE f.rn = a.rn + ${delta}
		LIMIT 1
	`);

	const row = rows[0] as { answer_id?: unknown } | undefined;
	return row?.answer_id ? String(row.answer_id) : null;
}

export async function getQnaLogAdjacent(args: {
	studentId: string;
	currentAnswerId: string;
	direction: "next" | "prev";
	filters: QnaLogFilters;
	sort: QnaLogSort;
}): Promise<string | null> {
	const anchor = await fetchAnchorRow({
		studentId: args.studentId,
		answerId: args.currentAnswerId,
		filters: args.filters,
	});
	if (!anchor) return null;

	if (args.sort.key === "date") {
		const keysetHit = await getAdjacentByKeyset({
			studentId: args.studentId,
			anchor,
			direction: args.direction,
			filters: args.filters,
			sort: args.sort,
		});
		if (keysetHit) return keysetHit;
	}

	return getAdjacentByWindow(args);
}
