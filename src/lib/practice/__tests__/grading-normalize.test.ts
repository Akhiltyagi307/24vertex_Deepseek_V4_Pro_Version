import { describe, expect, it } from "vitest";

import type { GradingQuestionInput } from "@/lib/practice/grading-prompts";
import { normalizeGradedQuestionItem, verdictFromScore } from "@/lib/practice/grading-normalize";
import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

const baseQuestion: GradingQuestionInput = {
	question_id: "00000000-0000-4000-8000-000000000001",
	topic_id: "00000000-0000-4000-8000-000000000002",
	topic_name: "Topic",
	question_number: 1,
	question_type: "short_answer",
	question_text: "Explain X.",
	question_difficulty: "medium",
	options: null,
	answer_key: {},
	student_answer_raw: { kind: "text", value: "answer" },
	student_answer_text: "answer",
};

function item(overrides: Partial<GradedQuestionItem>): GradedQuestionItem {
	return {
		question_id: baseQuestion.question_id,
		topic_id: baseQuestion.topic_id,
		user_answer_summary: "s",
		reference_answer_summary: "r",
		verdict: "partially_correct",
		analysis: "a",
		score: 50,
		band_label: "Partial credit (50% band)",
		what_was_correct: ["idea"],
		where_marks_were_lost: ["gap"],
		to_reach_next_band: "add detail",
		...overrides,
	};
}

describe("grading-normalize", () => {
	it("maps verdict from score for MCQ", () => {
		expect(verdictFromScore(100, "multiple_choice")).toBe("correct");
		expect(verdictFromScore(0, "multiple_choice")).toBe("incorrect");
	});

	it("clears where_marks_were_lost at score 100", () => {
		const normalized = normalizeGradedQuestionItem(
			baseQuestion,
			item({ score: 100, verdict: "correct", where_marks_were_lost: ["should clear"] }),
		);
		expect(normalized.where_marks_were_lost).toEqual([]);
		expect(normalized.to_reach_next_band).toBe("");
	});

	it("fixes mismatched verdict to match score", () => {
		const normalized = normalizeGradedQuestionItem(
			baseQuestion,
			item({ score: 50, verdict: "correct" }),
		);
		expect(normalized.verdict).toBe("partially_correct");
	});
});
