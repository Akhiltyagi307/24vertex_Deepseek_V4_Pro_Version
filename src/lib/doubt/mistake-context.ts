import type { SupabaseClient } from "@supabase/supabase-js";

export type MistakeParts = {
	questionText: string | null;
	studentAnswerSummary: string | null;
	referenceAnswerSummary: string | null;
	feedback: string | null;
};

/**
 * Pure: render the student-mistake grounding block injected into the doubt
 * prompt's scope. Returns null when there is nothing useful to ground on.
 */
export function formatMistakeBlock(parts: MistakeParts): string | null {
	const lines: string[] = [];
	if (parts.questionText) lines.push(`Question the student got wrong:\n${parts.questionText}`);
	if (parts.studentAnswerSummary) lines.push(`What the student answered:\n${parts.studentAnswerSummary}`);
	if (parts.referenceAnswerSummary) lines.push(`Correct / reference answer:\n${parts.referenceAnswerSummary}`);
	if (parts.feedback) lines.push(`Grader feedback:\n${parts.feedback}`);
	if (lines.length === 0) return null;
	return lines.join("\n\n");
}

/**
 * Load a student's mistake for a question, ownership-checked: the question's
 * test must belong to `studentId` and the answer must be incorrect. Returns the
 * formatted block plus the topic/subject so the caller can scope the chat.
 * Null if not found / not owned / answered correctly / nothing to ground on.
 *
 * Uses explicit queries (no PostgREST nested embed) for portability.
 */
export async function loadMistakeForQuestion(
	supabase: SupabaseClient,
	studentId: string,
	questionId: string,
): Promise<{ block: string; topicId: string; subjectId: string } | null> {
	const { data: qData } = await supabase
		.from("questions")
		.select("question_text, topic_id, test_id")
		.eq("id", questionId)
		.maybeSingle();
	const q = qData as { question_text: string | null; topic_id: string; test_id: string } | null;
	if (!q) return null;

	const { data: testData } = await supabase
		.from("tests")
		.select("student_id, subject_id")
		.eq("id", q.test_id)
		.maybeSingle();
	const test = testData as { student_id: string; subject_id: string } | null;
	if (!test || test.student_id !== studentId) return null; // ownership gate

	const { data: ansData } = await supabase
		.from("student_answers")
		.select("is_correct, ai_feedback, ai_user_answer_summary, ai_reference_answer_summary")
		.eq("question_id", questionId)
		.maybeSingle();
	const ans = ansData as {
		is_correct: boolean | null;
		ai_feedback: string | null;
		ai_user_answer_summary: string | null;
		ai_reference_answer_summary: string | null;
	} | null;
	if (!ans || ans.is_correct === true) return null; // only ground on real mistakes

	const block = formatMistakeBlock({
		questionText: q.question_text,
		studentAnswerSummary: ans.ai_user_answer_summary,
		referenceAnswerSummary: ans.ai_reference_answer_summary,
		feedback: ans.ai_feedback,
	});
	if (!block) return null;
	return { block, topicId: q.topic_id, subjectId: test.subject_id };
}
