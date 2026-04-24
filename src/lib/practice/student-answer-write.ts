import type { SupabaseClient } from "@supabase/supabase-js";

type ServerSupabase = SupabaseClient;

export type StudentAnswerWriteRow = {
	test_id: string;
	question_id: string;
	student_answer: unknown;
	updated_at: string;
	flagged_for_review?: boolean;
	is_correct?: boolean | null;
	score_earned?: string | null;
	ai_feedback?: string | null;
	time_spent_ms?: number | null;
	visits?: number | null;
};

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
	if (row.time_spent_ms !== undefined && row.time_spent_ms !== null) {
		insertPayload.time_spent_ms = row.time_spent_ms;
	}
	if (row.visits !== undefined && row.visits !== null) {
		insertPayload.visits = row.visits;
	}

	const { error } = await supabase
		.from("student_answers")
		.upsert(insertPayload, { onConflict: "test_id,question_id" });

	return { error };
}
