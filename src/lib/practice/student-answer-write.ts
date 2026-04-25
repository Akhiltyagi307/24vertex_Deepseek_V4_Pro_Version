import type { SupabaseClient } from "@supabase/supabase-js";

import { logServerError } from "@/lib/server/log-supabase-error";

type ServerSupabase = SupabaseClient;

/**
 * `student_answers.score_earned` is DECIMAL(5,2) with CHECK (BETWEEN 0 AND 100).
 * Plain `toFixed(2)` can round past 100 (e.g. 100.006 → "100.01") and fail the check.
 */
export function formatScoreEarnedForDb(score: number): string {
	const n = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
	return n.toFixed(2);
}

export type StudentAnswerWriteRow = {
	test_id: string;
	question_id: string;
	student_answer: unknown;
	updated_at: string;
	flagged_for_review?: boolean;
	is_correct?: boolean | null;
	score_earned?: string | null;
	ai_feedback?: string | null;
	/** Grader output for PDFs; see migration 20260426120000_student_answers_ai_report_summaries.sql */
	ai_user_answer_summary?: string | null;
	ai_reference_answer_summary?: string | null;
	time_spent_ms?: number | null;
	visits?: number | null;
};

/** True when PostgREST reports a missing column (migration not applied on this DB). */
export function isPostgrestMissingColumnError(
	error: { message: string; code?: string; details?: string | null; hint?: string | null } | null,
): boolean {
	if (!error) return false;
	if (error.code === "42703") return true;
	const blob = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
	return blob.includes("column") && (blob.includes("does not exist") || blob.includes("undefined column"));
}

function buildInsertPayload(
	row: StudentAnswerWriteRow,
	opts: { includeAiSummaryColumns: boolean },
): Record<string, unknown> {
	const insertPayload: Record<string, unknown> = {
		test_id: row.test_id,
		question_id: row.question_id,
		student_answer: row.student_answer,
		flagged_for_review: row.flagged_for_review ?? false,
		updated_at: row.updated_at,
	};
	if (row.is_correct !== undefined) {
		insertPayload.is_correct = row.is_correct;
	}
	if (row.score_earned !== undefined) {
		insertPayload.score_earned = row.score_earned;
	}
	if (row.ai_feedback !== undefined) {
		insertPayload.ai_feedback = row.ai_feedback;
	}
	if (opts.includeAiSummaryColumns) {
		if (row.ai_user_answer_summary !== undefined) {
			insertPayload.ai_user_answer_summary = row.ai_user_answer_summary;
		}
		if (row.ai_reference_answer_summary !== undefined) {
			insertPayload.ai_reference_answer_summary = row.ai_reference_answer_summary;
		}
	}
	if (row.time_spent_ms !== undefined && row.time_spent_ms !== null) {
		insertPayload.time_spent_ms = row.time_spent_ms;
	}
	if (row.visits !== undefined && row.visits !== null) {
		insertPayload.visits = row.visits;
	}
	return insertPayload;
}

/**
 * Phase 1: we now rely on the `(test_id, question_id)` unique index in
 * [supabase/migrations/20260419120000_student_answers_unique_test_question.sql](supabase/migrations/20260419120000_student_answers_unique_test_question.sql)
 * so a real `upsert({ onConflict })` is safe — no more manual find-then-insert
 * race.
 */
export async function writeStudentAnswerRow(
	supabase: ServerSupabase,
	row: StudentAnswerWriteRow,
): Promise<{ error: { message: string; code?: string; details?: string | null } | null }> {
	const hasSummaryCols =
		row.ai_user_answer_summary !== undefined || row.ai_reference_answer_summary !== undefined;

	const insertPayload = buildInsertPayload(row, { includeAiSummaryColumns: true });
	const { error } = await supabase
		.from("student_answers")
		.upsert(insertPayload, { onConflict: "test_id,question_id" });

	if (error && hasSummaryCols && isPostgrestMissingColumnError(error)) {
		const retryPayload = buildInsertPayload(row, { includeAiSummaryColumns: false });
		const { error: err2 } = await supabase
			.from("student_answers")
			.upsert(retryPayload, { onConflict: "test_id,question_id" });
		if (!err2) {
			logServerError(
				"writeStudentAnswerRow.missing_ai_summary_columns",
				"Upsert ok after omitting ai_user_answer_summary / ai_reference_answer_summary. Apply supabase/migrations/20260426120000_student_answers_ai_report_summaries.sql on this database.",
				{ testId: row.test_id, questionId: row.question_id },
			);
		}
		return { error: err2 };
	}

	return { error };
}

const MAX_STUDENT_ANSWERS_PER_UPSERT = 100;

function rowHasAiSummaryColumns(row: StudentAnswerWriteRow): boolean {
	return (
		row.ai_user_answer_summary !== undefined || row.ai_reference_answer_summary !== undefined
	);
}

/**
 * Batch upsert for `student_answers` using the same `(test_id, question_id)` conflict target.
 * Splits into chunks; on missing AI summary columns, retries the chunk without those columns; on
 * any remaining error, falls back to {@link writeStudentAnswerRow} per row so a single bad row
 * does not block the rest.
 */
export async function writeStudentAnswerRows(
	supabase: ServerSupabase,
	rows: StudentAnswerWriteRow[],
): Promise<{ error: { message: string; code?: string; details?: string | null } | null }> {
	if (rows.length === 0) return { error: null };

	for (let i = 0; i < rows.length; i += MAX_STUDENT_ANSWERS_PER_UPSERT) {
		const chunk = rows.slice(i, i + MAX_STUDENT_ANSWERS_PER_UPSERT);
		const { error } = await upsertStudentAnswerChunk(supabase, chunk);
		if (error) return { error };
	}
	return { error: null };
}

async function upsertStudentAnswerChunk(
	supabase: ServerSupabase,
	rows: StudentAnswerWriteRow[],
): Promise<{ error: { message: string; code?: string; details?: string | null } | null }> {
	const hasAnySummary = rows.some(rowHasAiSummaryColumns);

	const payloadsWithSummary = rows.map((r) => buildInsertPayload(r, { includeAiSummaryColumns: true }));
	let { error } = await supabase
		.from("student_answers")
		.upsert(payloadsWithSummary, { onConflict: "test_id,question_id" });

	if (error && hasAnySummary && isPostgrestMissingColumnError(error)) {
		const payloadsNoSummary = rows.map((r) => buildInsertPayload(r, { includeAiSummaryColumns: false }));
		const second = await supabase
			.from("student_answers")
			.upsert(payloadsNoSummary, { onConflict: "test_id,question_id" });
		error = second.error;
		if (!error) {
			logServerError(
				"writeStudentAnswerRows.missing_ai_summary_columns",
				"Batch upsert ok after omitting ai_user_answer_summary / ai_reference_answer_summary. Apply supabase/migrations/20260426120000_student_answers_ai_report_summaries.sql on this database.",
				{ n: rows.length },
			);
		}
	}

	if (error) {
		for (const row of rows) {
			const { error: oneErr } = await writeStudentAnswerRow(supabase, row);
			if (oneErr) {
				return { error: oneErr };
			}
		}
	}

	return { error: null };
}
