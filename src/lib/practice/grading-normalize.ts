import type { GradingQuestionInput } from "@/lib/practice/grading-prompts";
import type { GradedQuestionItem } from "@/lib/practice/grading-schema";
import { LONG_ANSWER_CRITERION_NAMES } from "@/lib/practice/grading-schema";

export function verdictFromScore(
	score: number,
	questionType: GradingQuestionInput["question_type"],
): GradedQuestionItem["verdict"] {
	if (questionType === "multiple_choice") {
		return score >= 85 ? "correct" : "incorrect";
	}
	if (score >= 85) return "correct";
	if (score <= 24) return "incorrect";
	return "partially_correct";
}

export type GradingBreakdownValidationIssue = {
	question_id: string;
	question_number: number;
	issues: string[];
};

/** Soft checks: log-only hints; does not change scores. */
export function validateGradingBreakdown(
	question: GradingQuestionInput,
	item: GradedQuestionItem,
): string[] {
	const issues: string[] = [];
	const score = item.score;

	if (!item.band_label?.trim()) issues.push("missing band_label");

	if (!item.what_was_correct?.length) {
		issues.push("what_was_correct is empty");
	}

	if (score >= 100) {
		if (item.where_marks_were_lost?.length) {
			issues.push("where_marks_were_lost should be empty at score 100");
		}
	} else {
		if (!item.where_marks_were_lost?.length) {
			issues.push("where_marks_were_lost required when score < 100");
		}
		if (!item.to_reach_next_band?.trim()) {
			issues.push("to_reach_next_band required when score < 100");
		}
	}

	if (question.question_type === "long_answer" && score < 100) {
		if (!item.criterion_scores?.length) {
			issues.push("criterion_scores required for long_answer below 100");
		} else if (item.criterion_scores.length !== 5) {
			issues.push(`criterion_scores must have 5 rows (got ${item.criterion_scores.length})`);
		} else {
			const sum = item.criterion_scores.reduce((s, c) => s + c.points, 0);
			if (sum !== score) {
				issues.push(`criterion_scores sum ${sum} != score ${score}`);
			}
		}
	}

	const expectedVerdict = verdictFromScore(score, question.question_type);
	if (item.verdict !== expectedVerdict) {
		issues.push(`verdict ${item.verdict} does not match score band (expected ${expectedVerdict})`);
	}

	return issues;
}

/** Align verdict with score; trim lists; fill band_label fallback. */
export function normalizeGradedQuestionItem(
	question: GradingQuestionInput,
	item: GradedQuestionItem,
): GradedQuestionItem {
	const score = Math.min(100, Math.max(0, item.score));
	const verdict = verdictFromScore(score, question.question_type);

	let band_label = item.band_label?.trim() ?? "";
	if (!band_label) {
		band_label =
			verdict === "correct" ? "Full credit"
			: verdict === "incorrect" ? "Needs work"
			: `Partial credit (${Math.round(score)}%)`;
	}

	const what_was_correct = (item.what_was_correct ?? []).map((s) => s.trim()).filter(Boolean);
	const where_marks_were_lost =
		score >= 100 ? [] : (item.where_marks_were_lost ?? []).map((s) => s.trim()).filter(Boolean);
	const to_reach_next_band = score >= 100 ? "" : (item.to_reach_next_band ?? "").trim();

	let criterion_scores = item.criterion_scores;
	if (question.question_type === "long_answer" && criterion_scores?.length === 5) {
		criterion_scores = criterion_scores.map((c, i) => ({
			name: c.name?.trim() || (LONG_ANSWER_CRITERION_NAMES[i] ?? `Criterion ${i + 1}`),
			points: c.points,
			note: c.note.trim(),
		}));
	}

	if (score >= 100 && what_was_correct.length === 0) {
		what_was_correct.push("Full credit on this item.");
	}

	return {
		...item,
		score,
		verdict,
		band_label,
		what_was_correct,
		where_marks_were_lost,
		to_reach_next_band,
		criterion_scores,
	};
}
