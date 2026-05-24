import { describe, expect, it } from "vitest";

import {
	formatGradingFeedbackForStorage,
	GRADING_META_MARKER,
	gradedItemFromStoredFeedback,
	parseStoredGradingFeedback,
} from "@/lib/practice/grading-feedback-format";
import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

const sampleItem: GradedQuestionItem = {
	question_id: "00000000-0000-4000-8000-000000000001",
	topic_id: "00000000-0000-4000-8000-000000000002",
	user_answer_summary: "You wrote about photosynthesis.",
	reference_answer_summary: "The answer explains light reactions.",
	verdict: "partially_correct",
	analysis: "Good start; add the Calvin cycle.",
	step_by_step_solution: "1. Light hits chlorophyll.",
	score: 50,
	band_label: "Partial credit (50% band)",
	what_was_correct: ["Named chlorophyll"],
	where_marks_were_lost: ["Missing Calvin cycle detail"],
	to_reach_next_band: "To move from 50 to 75, name both stages.",
};

describe("grading-feedback-format", () => {
	it("round-trips meta + analysis + step-by-step", () => {
		const stored = formatGradingFeedbackForStorage(sampleItem);
		expect(stored.startsWith(GRADING_META_MARKER)).toBe(true);
		const parsed = parseStoredGradingFeedback(stored);
		expect(parsed.meta?.band_label).toBe("Partial credit (50% band)");
		expect(parsed.meta?.where_marks_were_lost).toEqual(["Missing Calvin cycle detail"]);
		expect(parsed.analysis).toBe("Good start; add the Calvin cycle.");
		expect(parsed.stepByStep).toBe("1. Light hits chlorophyll.");
	});

	it("parses legacy feedback without meta", () => {
		const legacy = "Nice try.\n\nStep-by-step:\n1. Do X.";
		const parsed = parseStoredGradingFeedback(legacy);
		expect(parsed.meta).toBeNull();
		expect(parsed.analysis).toBe("Nice try.");
		expect(parsed.stepByStep).toBe("1. Do X.");
	});

	it("gradedItemFromStoredFeedback merges DB fields", () => {
		const stored = formatGradingFeedbackForStorage(sampleItem);
		const merged = gradedItemFromStoredFeedback({
			question_id: sampleItem.question_id,
			topic_id: sampleItem.topic_id,
			score: 50,
			verdict: "partially_correct",
			user_answer_summary: "x",
			reference_answer_summary: "y",
			ai_feedback: stored,
		});
		expect(merged.band_label).toBe("Partial credit (50% band)");
		expect(merged.where_marks_were_lost).toHaveLength(1);
	});
});
