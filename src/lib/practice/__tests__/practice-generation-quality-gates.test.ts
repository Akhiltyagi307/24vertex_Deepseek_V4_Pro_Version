import { describe, expect, it } from "vitest";

import {
	__test as gatesTest,
	evaluatePracticeGenerationQuality,
} from "../practice-generation-quality-gates";
import type { PracticeGenerationOutput } from "../generation-schema";

function makeQuestion(
	overrides: Partial<PracticeGenerationOutput["questions"][number]> = {},
): PracticeGenerationOutput["questions"][number] {
	return {
		question_number: 1,
		topic_id: "11111111-1111-4111-8111-111111111111",
		topic_name: "Topic A",
		question_text: "What is 2 + 2?",
		question_type: "multiple_choice",
		difficulty_level: "easy",
		options: { A: "3", B: "4", C: "5", D: "6" },
		answer_key: {
			correct_answer: "B",
			explanation: "2 + 2 = 4",
			common_mistakes: [],
			related_concept: "addition",
		},
		estimated_time_seconds: 60,
		visual: null,
		...overrides,
	};
}

describe("evaluatePracticeGenerationQuality", () => {
	it("passes balanced outputs", () => {
		const questions: PracticeGenerationOutput["questions"] = [
			makeQuestion({
				question_number: 1,
				topic_id: "11111111-1111-4111-8111-111111111111",
				question_text: "Find the value of 2 + 2.",
				difficulty_level: "easy",
			}),
			makeQuestion({
				question_number: 2,
				topic_id: "22222222-2222-4222-8222-222222222222",
				question_text: "Solve for x in x + 5 = 9.",
				difficulty_level: "medium",
			}),
			makeQuestion({
				question_number: 3,
				topic_id: "33333333-3333-4333-8333-333333333333",
				question_text: "Evaluate 12 x 7.",
				difficulty_level: "hard",
			}),
		];
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(true);
	});

	it("fails near-duplicate stems", () => {
		const questions: PracticeGenerationOutput["questions"] = [
			makeQuestion({
				question_number: 1,
				question_text: "What is the capital of India?",
			}),
			makeQuestion({
				question_number: 2,
				question_text: "What is the capital city of India?",
			}),
		];
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("near_duplicate_stems");
	});

	it("fails when one topic dominates", () => {
		const questions: PracticeGenerationOutput["questions"] = Array.from({ length: 10 }, (_, i) =>
			makeQuestion({
				question_number: i + 1,
				topic_id:
					i < 8 ?
						"11111111-1111-4111-8111-111111111111"
					:	"22222222-2222-4222-8222-222222222222",
				question_text: `Q${i + 1}`,
			}),
		);
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("topic_concentration");
	});

	it("allows single-difficulty tests when other quality checks pass", () => {
		const questions: PracticeGenerationOutput["questions"] = Array.from({ length: 10 }, (_, i) =>
			makeQuestion({
				question_number: i + 1,
				question_text: `Question ${i + 1} with unique wording`,
				difficulty_level: "easy",
				topic_id: `11111111-1111-4111-8111-11111111111${i}`,
			}),
		);
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(true);
	});

	it("flags stems referencing 'the figure' with no visual emitted", () => {
		const questions: PracticeGenerationOutput["questions"] = [
			makeQuestion({
				question_number: 1,
				question_text:
					"In the figure shown above, find the slope of segment AB joining the labelled points.",
			}),
			makeQuestion({
				question_number: 2,
				question_text: "Find the value of 2 + 2 in unique wording.",
				topic_id: "22222222-2222-4222-8222-222222222222",
			}),
		];
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("stem_references_missing_visual");
	});

	it("flags label drift between stem and visual spec", () => {
		const questions: PracticeGenerationOutput["questions"] = [
			makeQuestion({
				question_number: 1,
				question_text: "Find the slope of segment BC shown below.",
				visual: {
					caption: "Segment AB on the coordinate plane.",
					altText: "Segment AB.",
					spec: {
						kind: "math_geometry",
						view: { xMin: 0, xMax: 6, yMin: 0, yMax: 10, showGrid: true, showAxes: true },
						primitives: [
							{ type: "point", at: { x: 1, y: 2 }, label: "A" },
							{ type: "point", at: { x: 4, y: 8 }, label: "B" },
						],
					},
				},
			}),
			makeQuestion({
				question_number: 2,
				question_text: "Find the value of 2 + 2 in unique wording.",
				topic_id: "22222222-2222-4222-8222-222222222222",
			}),
		];
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("visual_label_mismatch");
	});

	it("passes when every stem label appears in the visual spec", () => {
		const questions: PracticeGenerationOutput["questions"] = [
			makeQuestion({
				question_number: 1,
				question_text: "Find the slope of segment AB shown below.",
				visual: {
					caption: "Segment AB.",
					altText: "Segment AB.",
					spec: {
						kind: "math_geometry",
						view: { xMin: 0, xMax: 6, yMin: 0, yMax: 10, showGrid: true, showAxes: true },
						primitives: [
							{ type: "point", at: { x: 1, y: 2 }, label: "A" },
							{ type: "point", at: { x: 4, y: 8 }, label: "B" },
						],
					},
				},
			}),
			makeQuestion({
				question_number: 2,
				question_text: "Find the value of 2 + 2 in unique wording.",
				topic_id: "22222222-2222-4222-8222-222222222222",
			}),
		];
		const out = evaluatePracticeGenerationQuality({ questions });
		expect(out.ok).toBe(true);
	});
});

describe("extractStemLabels", () => {
	it("strips MCQ option markers", () => {
		expect(gatesTest.extractStemLabels("Choose the correct option (A) (B) (C) (D)")).toEqual(
			[],
		);
	});
	it("returns single-letter point labels", () => {
		expect(gatesTest.extractStemLabels("Find the slope of segment AB shown.").sort()).toEqual([
			"B",
		]);
	});
	it("ignores I and A as noise (article + pronoun)", () => {
		expect(gatesTest.extractStemLabels("In the diagram, A B C are collinear with I.")).toEqual(
			["B", "C"],
		);
	});
});
