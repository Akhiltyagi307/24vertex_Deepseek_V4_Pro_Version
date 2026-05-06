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

/**
 * Per-question-type scoring rubric. Anchors each type to a fixed set of
 * allowed scores so the same answer earns the same score across grading
 * runs — this is the predictable mechanism behind grading consistency.
 *
 * Verdict is always derived from score (see VERDICT_FROM_SCORE block):
 *   - correct           ≥ 85
 *   - partially_correct 25–84
 *   - incorrect         ≤ 24
 */
const SCORING_RUBRIC = [
	"SCORING RUBRIC (predictable, type-anchored — pick a band, do not free-score):",
	"  • multiple_choice: BINARY only. Allowed scores: 100 (matches answer_key.correct_answer) or 0 (anything else). No partial credit. Verdict = correct or incorrect. Even though MCQ is binary, ALWAYS produce a full analysis explaining why the chosen option is right or wrong, and a reference_answer_summary.",
	"  • fill_in_blank: TERNARY. Allowed scores: 100 (exact / accepted synonym), 50 (right concept, wrong form — minor spelling, plural/singular, units mismatch), 0 (wrong concept).",
	"  • numerical: TERNARY. Allowed scores: 100 (correct value within accepted tolerance, units consistent), 50 (correct method but arithmetic slip OR right magnitude wrong sign / units), 0 (wrong method or no work shown when method matters).",
	"  • short_answer: 5-band rubric. Allowed scores: 100 (complete + accurate + correct terminology), 75 (complete + accurate but missing a term or one minor inaccuracy), 50 (one key idea correct, second idea missing or wrong), 25 (relevant attempt with major gap), 0 (off-topic or empty).",
	"  • long_answer: 5-criteria rubric, 20 points each → score = sum (always a multiple of 10). Criteria: (1) Conceptual accuracy, (2) Coverage of all parts asked, (3) Use of correct terminology / formulae, (4) Logical structure / reasoning shown, (5) Worked example or supporting detail. Award 20 / 10 / 0 per criterion (full / partial / none).",
].join("\n");

const VERDICT_FROM_SCORE = [
	"VERDICT FROM SCORE (derive deterministically — must agree with the rubric):",
	"  • score ≥ 85 → verdict = correct",
	"  • 25 ≤ score ≤ 84 → verdict = partially_correct",
	"  • score ≤ 24 → verdict = incorrect",
	"  multiple_choice cannot be partially_correct (score is 100 or 0).",
].join("\n");

const SUBJECT_GUIDANCE: Record<string, string> = {
	math:
		"Mathematics: prioritize correct method and unit consistency. A right answer with no work shown for a multi-step problem is at most partially_correct on numerical/short_answer; full credit only when the rubric allows.",
	science:
		"Science (Physics/Chemistry/Biology): prioritize accurate terminology, correct units, and stated assumptions. Penalize a right number with wrong units to the partially_correct band.",
	english:
		"English / Languages: prioritize content over grammar — a grammatically imperfect answer that captures the intended idea earns full credit on short_answer / long_answer if all criteria are met. Spelling and grammar matter most for fill_in_blank.",
	social:
		"Social Science / Humanities: prioritize evidence and named examples. A correct general claim without a specific example is partially_correct on long_answer (criterion 5).",
};

function pickSubjectGuidance(subjectName: string): string {
	const lower = subjectName.toLowerCase();
	if (/\bmath/i.test(lower)) return SUBJECT_GUIDANCE.math;
	if (/\b(physics|chemistry|biology|science)\b/i.test(lower)) return SUBJECT_GUIDANCE.science;
	if (/\b(english|language|hindi|sanskrit|literature)\b/i.test(lower)) return SUBJECT_GUIDANCE.english;
	if (/\b(history|geography|civics|economics|political|social)\b/i.test(lower)) return SUBJECT_GUIDANCE.social;
	return "";
}

export function buildPracticeGradingSystemPrompt(params: {
	subjectName: string;
	requireMathSteps: boolean;
}): string {
	const mathRule = params.requireMathSteps ?
			"For EVERY numerical question, and for any Mathematics subject question where a worked solution is appropriate, include a clear step_by_step_solution (numbered steps)."
		:	"For EVERY numerical question, include step_by_step_solution with numbered steps.";

	const subjectGuidance = pickSubjectGuidance(params.subjectName);

	const lines: string[] = [
		"You are an expert educator grading a student's practice test.",
		`Subject: ${params.subjectName}.`,
		"You receive the full question list with official answer keys and the student's responses.",
		"",
		SCORING_RUBRIC,
		"",
		VERDICT_FROM_SCORE,
	];

	if (subjectGuidance) {
		lines.push("", `SUBJECT GUIDANCE: ${subjectGuidance}`);
	}

	lines.push(
		"",
		"OUTPUT FIELDS (every question — including multiple_choice — must include all fields):",
		"  • analysis: a brief, actionable explanation of why credit was or wasn't awarded — focus on the misconception or missing step. Plain text, no markdown.",
		`  • step_by_step_solution: numbered steps showing the correct working. ${mathRule}`,
		"  • user_answer_summary: 1–2 sentences paraphrasing what the student wrote, suitable for a PDF.",
		"  • reference_answer_summary: 1–2 sentences paraphrasing the official answer, suitable for a PDF.",
		"  • Echo question_id and topic_id EXACTLY as provided. Never invent IDs.",
		"",
		"Return only structured data matching the schema — no markdown fences or commentary outside JSON.",
	);
	return lines.join("\n");
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
