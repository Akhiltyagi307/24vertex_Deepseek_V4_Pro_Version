import { describe, expect, it } from "vitest";

import { applyDeterministicPracticeAutofix } from "../practice-generation-autofix";
import type { PracticeGenerationOutput } from "../generation-schema";

function makeBaseOutput(
	questions: PracticeGenerationOutput["questions"],
): PracticeGenerationOutput {
	return {
		questions,
		generation_metadata: {
			topic_distribution: {},
			difficulty_distribution: {},
			type_distribution: {},
			adaptation_rationale: "x",
		},
	};
}

describe("applyDeterministicPracticeAutofix", () => {
	it("resequences question numbers and normalizes non-MCQ fields", () => {
		const raw = makeBaseOutput([
			{
				question_number: 7,
				topic_id: "11111111-1111-4111-8111-111111111111 ",
				topic_name: "Topic A",
				question_text: "Fill",
				question_type: "fill_in_blank",
				difficulty_level: "easy",
				options: { A: "x" },
				answer_key: {
					correct_answer: "  mitochondria  ",
					explanation: "exp",
					common_mistakes: [],
					related_concept: "bio",
				},
				estimated_time_seconds: -3,
			},
			{
				question_number: 99,
				topic_id: "22222222-2222-4222-8222-222222222222",
				topic_name: "Topic B",
				question_text: "MCQ",
				question_type: "multiple_choice",
				difficulty_level: "medium",
				options: { A: "One", B: "Two", C: "Three", D: "Four" },
				answer_key: {
					correct_answer: " b ",
					explanation: "exp",
					common_mistakes: [],
					related_concept: "math",
				},
				estimated_time_seconds: 24.6,
			},
		]);

		const out = applyDeterministicPracticeAutofix(raw);
		expect(out.questions[0]?.question_number).toBe(1);
		expect(out.questions[1]?.question_number).toBe(2);
		expect(out.questions[0]?.options).toBeNull();
		expect(out.questions[0]?.estimated_time_seconds).toBe(60);
		expect(out.questions[1]?.estimated_time_seconds).toBe(25);
		expect(out.questions[0]?.topic_id).toBe("11111111-1111-4111-8111-111111111111");
		expect(out.questions[1]?.answer_key.correct_answer).toBe("B");
	});

	it("normalizes obvious decorated letter answers", () => {
		const raw = makeBaseOutput([
			{
				question_number: 1,
				topic_id: "11111111-1111-4111-8111-111111111111",
				topic_name: "Topic",
				question_text: "MCQ",
				question_type: "multiple_choice",
				difficulty_level: "hard",
				options: { A: "x", B: "y", C: "z", D: "w" },
				answer_key: {
					correct_answer: "Option c)",
					explanation: "exp",
					common_mistakes: [],
					related_concept: "x",
				},
				estimated_time_seconds: 10,
			},
		]);

		const out = applyDeterministicPracticeAutofix(raw);
		expect(out.questions[0]?.answer_key.correct_answer).toBe("C");
	});

	it("maps answer text to unique MCQ option letter", () => {
		const raw = makeBaseOutput([
			{
				question_number: 1,
				topic_id: "11111111-1111-4111-8111-111111111111",
				topic_name: "Topic",
				question_text: "MCQ",
				question_type: "multiple_choice",
				difficulty_level: "hard",
				options: { A: "Mercury", B: "Venus", C: "Earth", D: "Mars" },
				answer_key: {
					correct_answer: "earth",
					explanation: "exp",
					common_mistakes: [],
					related_concept: "x",
				},
				estimated_time_seconds: 10,
			},
		]);

		const out = applyDeterministicPracticeAutofix(raw);
		expect(out.questions[0]?.answer_key.correct_answer).toBe("C");
	});
});
