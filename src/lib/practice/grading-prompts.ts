/**
 * Full-test AI grading: product choice is one model pass (or chunked) over the entire submitted test,
 * including items that were previously auto-keyed for MCQ — we re-grade in context for a unified rubric.
 */

export type GradingQuestionInput = {
	question_id: string;
	topic_id: string;
	topic_name: string;
	question_number: number;
	question_type:
		| "multiple_choice"
		| "short_answer"
		| "numerical"
		| "fill_in_blank"
		| "long_answer";
	question_text: string;
	options: Record<string, string> | null;
	/** Full answer key JSON from DB — server only. */
	answer_key: unknown;
	/** Serialized student response */
	student_answer_raw: unknown;
	student_answer_text: string;
};

export function stringifyStudentAnswer(payload: unknown): string {
	if (payload == null) return "(no answer submitted)";
	if (typeof payload !== "object" || payload === null) return String(payload);
	const o = payload as Record<string, unknown>;
	if (o.kind === "mcq" && typeof o.value === "string") {
		return o.value.trim() ? `Selected: ${o.value.trim().toUpperCase()}` : "(no option selected)";
	}
	if (o.kind === "text" && typeof o.value === "string") {
		return o.value.trim() || "(empty)";
	}
	if (o.kind === "numerical" && typeof o.value === "string") {
		return o.value.trim() || "(empty)";
	}
	return JSON.stringify(payload);
}

export function buildPracticeGradingSystemPrompt(params: {
	subjectName: string;
	requireMathSteps: boolean;
}): string {
	const mathRule = params.requireMathSteps ?
			"For EVERY numerical question, and for any Mathematics subject question where a worked solution is appropriate, include a clear step_by_step_solution (numbered steps). "
		:	"For EVERY numerical question, include step_by_step_solution with numbered steps. ";

	return [
		"You are an expert educator grading a student's practice test.",
		`Subject: ${params.subjectName}.`,
		"You receive the full question list with official answer keys and the student's responses.",
		"Grade each question fairly. Use the verdict: correct, partially_correct, or incorrect.",
		"Score each question from 0 to 100 (integers or decimals allowed).",
		"analysis must be helpful for the student (why they got credit or what to fix).",
		mathRule,
		"Echo question_id and topic_id exactly as provided.",
		"user_answer_summary and reference_answer_summary must be concise plain text suitable for a PDF.",
		"Return only structured data matching the schema — no markdown fences or commentary outside JSON.",
	].join(" ");
}

export function buildPracticeGradingUserPrompt(
	chunkLabel: string,
	questions: GradingQuestionInput[],
): string {
	const lines: string[] = [
		`Grade this batch: ${chunkLabel}`,
		"",
		...questions.map((q) => {
			const opts =
				q.options && Object.keys(q.options).length > 0 ?
					JSON.stringify(q.options)
				:	"null";
			return [
				`---`,
				`question_id: ${q.question_id}`,
				`topic_id: ${q.topic_id}`,
				`topic_name: ${q.topic_name}`,
				`question_number: ${q.question_number}`,
				`question_type: ${q.question_type}`,
				`question_text: ${q.question_text}`,
				`options: ${opts}`,
				`answer_key (official): ${JSON.stringify(q.answer_key)}`,
				`student_answer (raw json): ${JSON.stringify(q.student_answer_raw)}`,
				`student_answer (readable): ${q.student_answer_text}`,
			].join("\n");
		}),
	];
	return lines.join("\n");
}
