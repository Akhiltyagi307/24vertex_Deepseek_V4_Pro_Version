/**
 * Full-test AI grading: product choice is one model pass (or chunked) over the entire submitted test,
 * including items that were previously auto-keyed for MCQ — we re-grade in context for a unified rubric.
 */

import { LONG_ANSWER_CRITERION_NAMES } from "@/lib/practice/grading-schema";

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
	question_difficulty: string | null;
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

const SCORING_RUBRIC = [
	"SCORING RUBRIC (practice mode — pick ONE allowed score per question; do not invent other numbers):",
	"  • multiple_choice: 100 or 0 only. 100 = student letter matches answer_key.correct_answer (ignore case). 0 = anything else.",
	"  • fill_in_blank: 100 | 50 | 0 — 100 exact/accepted synonym; 50 right idea wrong form (spelling, units, plural); 0 wrong idea.",
	"  • numerical: 100 | 50 | 0 — 100 value within tolerance and units OK; 50 right method minor slip or units/sign error; 0 wrong method.",
	"  • short_answer: 100 | 75 | 50 | 25 | 0 — see band meanings in OUTPUT section.",
	"  • long_answer: score = sum of five criteria (each 0, 10, or 20). Total must be 0, 10, 20, … 100.",
	`  • long_answer criteria names (use exactly in criterion_scores): ${LONG_ANSWER_CRITERION_NAMES.map((n) => `"${n}"`).join(", ")}.`,
].join("\n");

const VERDICT_FROM_SCORE = [
	"VERDICT (must match score):",
	"  • score ≥ 85 → verdict = correct",
	"  • 25 ≤ score ≤ 84 → verdict = partially_correct",
	"  • score ≤ 24 → verdict = incorrect",
	"  • multiple_choice: only correct or incorrect (never partially_correct).",
].join("\n");

const PRACTICE_GRADER_TONE = [
	"PRACTICE GRADER TONE (formative, not board-exam strict):",
	"  • Purpose: helpful practice feedback, not certification.",
	"  • If two score bands are both reasonable, choose the HIGHER band and say it was borderline in where_marks_were_lost.",
	"  • Do not drop short_answer or long_answer below 75 for grammar/spelling alone unless meaning is wrong.",
	"  • Empty answers: score 0, verdict incorrect, encouraging tone in analysis (no shaming).",
	"  • Use plain, supportive language: \"next step\", \"not yet\", \"to reach the next band\".",
].join("\n");

const SUBJECT_GUIDANCE: Record<string, string> = {
	math:
		"Mathematics: method and units matter. A correct final value with no work on a multi-step item is at most 50 on numerical/short_answer unless the rubric allows 100.",
	science:
		"Science: terminology and units matter. Right number with wrong units → 50 band, not 100.",
	english:
		"English / Languages: grade content over grammar on short_answer and long_answer. Grammar alone is not a reason for 25 or 0 if the idea is right.",
	social:
		"Social Science: named examples matter for long_answer criterion 5 (Worked example or supporting detail). General claim without example → 10 on that criterion, not 0 on the whole answer.",
};

function pickSubjectGuidance(subjectName: string): string {
	const lower = subjectName.toLowerCase();
	if (/\bmath/i.test(lower)) return SUBJECT_GUIDANCE.math;
	if (/\b(physics|chemistry|biology|science)\b/i.test(lower)) return SUBJECT_GUIDANCE.science;
	if (/\b(english|language|hindi|sanskrit|literature)\b/i.test(lower)) return SUBJECT_GUIDANCE.english;
	if (/\b(history|geography|civics|economics|political|social)\b/i.test(lower)) return SUBJECT_GUIDANCE.social;
	return "";
}

function allowedScoresLine(questionType: GradingQuestionInput["question_type"]): string {
	switch (questionType) {
		case "multiple_choice":
			return "Allowed scores: 100 or 0.";
		case "fill_in_blank":
		case "numerical":
			return "Allowed scores: 100, 50, or 0.";
		case "short_answer":
			return "Allowed scores: 100, 75, 50, 25, or 0.";
		case "long_answer":
			return "Allowed scores: multiples of 10 from 0 to 100 (sum of five criteria).";
		default:
			return "";
	}
}

type AnswerKeyBrief = {
	common_mistakes?: string[];
	marking_points?: string[];
	acceptable_variants?: string[];
	full_credit_requires?: string[];
	related_concept?: string;
};

function parseAnswerKeyBrief(answer_key: unknown): AnswerKeyBrief {
	if (!answer_key || typeof answer_key !== "object") return {};
	const o = answer_key as Record<string, unknown>;
	const asStrings = (v: unknown): string[] | undefined =>
		Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : undefined;
	return {
		common_mistakes: asStrings(o.common_mistakes),
		marking_points: asStrings(o.marking_points),
		acceptable_variants: asStrings(o.acceptable_variants),
		full_credit_requires: asStrings(o.full_credit_requires),
		related_concept: typeof o.related_concept === "string" ? o.related_concept.trim() : undefined,
	};
}

function buildQuestionGraderBrief(q: GradingQuestionInput): string {
	const brief = parseAnswerKeyBrief(q.answer_key);
	const lines: string[] = [`Grader brief: ${allowedScoresLine(q.question_type)}`];

	if (q.question_difficulty) {
		lines.push(`Difficulty: ${q.question_difficulty}.`);
	}

	if (brief.full_credit_requires?.length) {
		lines.push(`Full credit requires: ${brief.full_credit_requires.join("; ")}`);
	}
	if (brief.acceptable_variants?.length) {
		lines.push(`Acceptable variants: ${brief.acceptable_variants.join("; ")}`);
	}
	if (brief.marking_points?.length) {
		lines.push("Marking points:");
		for (const p of brief.marking_points) lines.push(`  - ${p}`);
	}
	if (brief.common_mistakes?.length) {
		lines.push("Common mistakes (map where_marks_were_lost when applicable):");
		for (const m of brief.common_mistakes) lines.push(`  - ${m}`);
	}
	if (brief.related_concept) {
		lines.push(`Related concept (tie to_reach_next_band when helpful): ${brief.related_concept}`);
	}

	if (q.question_type === "long_answer") {
		lines.push(
			"long_answer: fill criterion_scores with exactly 5 objects (names as in system prompt). points must be 0, 10, or 20 each; sum must equal score.",
		);
	}

	lines.push(
		"If score < 100: state the band in band_label, list deductions in where_marks_were_lost, and one actionable to_reach_next_band (e.g. \"To move from 50 to 75, add …\").",
	);

	return lines.join("\n");
}

export function buildPracticeGradingSystemPrompt(params: {
	subjectName: string;
	requireMathSteps: boolean;
}): string {
	const mathRule = params.requireMathSteps ?
			"For EVERY numerical question, and for any Mathematics subject question where a worked solution is appropriate, include step_by_step_solution (numbered steps)."
		:	"For EVERY numerical question, include step_by_step_solution (numbered steps).";

	const subjectGuidance = pickSubjectGuidance(params.subjectName);

	const lines: string[] = [
		"You are an expert educator grading a student's practice test for formative feedback.",
		`Subject: ${params.subjectName}.`,
		"You receive official answer keys and student responses per question.",
		"",
		PRACTICE_GRADER_TONE,
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
		"REQUIRED JSON FIELDS (every question):",
		"  • question_id, topic_id: copy EXACTLY from input.",
		"  • score: one allowed value for that question_type.",
		"  • verdict: must match score (see VERDICT).",
		"  • band_label: short label (REQUIRED, never empty), e.g. \"Partial credit (50% band)\" or \"Full credit\".",
		"  • what_was_correct: REQUIRED non-empty array of 1–3 short bullets (what the student got right). NEVER return [] or [\"\"]. At score 100 use e.g. \"Full credit on this item.\" Even fully-wrong answers must name at least one thing attempted correctly (e.g. \"Identified the correct formula\" or \"Set up the equation correctly\").",
		"  • where_marks_were_lost: array of bullets; MUST be [] when score is 100. When score < 100, at least one bullet naming the main gap (tie to rubric or common_mistakes).",
		"  • DIAGNOSTIC FEEDBACK (when score < 100):",
		"      - For multiple_choice: if answer_key.distractor_rationale exists and the student picked a wrong letter, find that letter's rationale and CITE IT in where_marks_were_lost. Example: \"You picked B — that's the COMMON-ERROR trap where students debit Capital instead of Cash for capital introduction.\"",
		"      - For fill_in_blank / short_answer / long_answer: if answer_key.expected_misanswers exists and the student's answer matches one of those entries (exact, case-insensitive, or close paraphrase), cite that entry's rationale in where_marks_were_lost. Example: \"You wrote 12 A — that's the V × R reversal; remember Ohm's Law is I = V / R.\"",
		"      - When citing distractor_rationale or expected_misanswers, name the archetype/trap; this turns generic 'wrong' feedback into 'you fell into THIS specific trap' feedback the student can learn from.",
		"  • to_reach_next_band: one sentence; empty string only when score is 100. Name the next band up (e.g. \"To move from 50 to 75, state …\").",
		"  • analysis: 1–3 sentence coach wrap-up ONLY. Do NOT repeat the bullet lists from what_was_correct / where_marks_were_lost.",
		"  • user_answer_summary, reference_answer_summary: 1–2 sentences each for PDF.",
		`  • step_by_step_solution: ${mathRule} Omit only for pure MCQ if nothing to show.`,
		"  • criterion_scores: REQUIRED for long_answer when score < 100 — exactly 5 rows, points 0|10|20, sum = score.",
		"",
		"Return only structured JSON matching the schema. No markdown fences.",
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
		...questions.flatMap((q) => {
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
				buildQuestionGraderBrief(q),
			];
		}),
	];
	return lines.join("\n");
}
