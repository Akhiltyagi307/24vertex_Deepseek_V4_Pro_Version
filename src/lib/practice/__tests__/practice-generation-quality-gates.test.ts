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

	it("allows one-topic requests to use the only selected topic", () => {
		const questions: PracticeGenerationOutput["questions"] = Array.from({ length: 10 }, (_, i) =>
			makeQuestion({
				question_number: i + 1,
				question_text: `Single selected topic question ${i + 1}`,
			}),
		);
		const out = evaluatePracticeGenerationQuality({ questions, allowedTopicCount: 1 });
		expect(out.ok).toBe(true);
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
		expect(out.details?.failedIndexes).toEqual([0]);
	});

	it("can defer missing-visual references during pre-enrichment drafting", () => {
		const questions: PracticeGenerationOutput["questions"] = Array.from({ length: 10 }, (_, i) =>
			makeQuestion({
				question_number: i + 1,
				question_text:
					i === 0 ?
						"Read the passage below and identify the speaker's main conflict."
					:	`Question ${i + 1} with distinct English supplementary wording.`,
				topic_id: `11111111-1111-4111-8111-11111111111${i}`,
			}),
		);
		const out = evaluatePracticeGenerationQuality({ questions, skipMissingVisualGate: true });
		expect(out.ok).toBe(true);
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

describe("visual leak and chunk alignment gates", () => {
	const tid = "11111111-1111-4111-8111-111111111111";
	const tidB = "22222222-2222-4222-8222-222222222222";

	function fillerSecondTopic(): PracticeGenerationOutput["questions"][number] {
		return makeQuestion({
			question_number: 2,
			topic_id: tidB,
			question_text: "Find the value of 2 + 2 phrased differently for variety.",
			visual: null,
		});
	}

	it("fails visual_leaks_answer when caption uses banned answer phrasing", () => {
		const q1 = makeQuestion({
			question_number: 1,
			question_text: "Refer to the coordinate sketch shown for this problem.",
			visual: {
				caption: "Note: answer is B.",
				altText: "Supplementary coordinate sketch for the problem layout.",
				spec: {
					kind: "math_geometry",
					view: { xMin: 0, xMax: 2, yMin: 0, yMax: 2, showGrid: true, showAxes: true },
					primitives: [{ type: "point", at: { x: 1, y: 1 }, label: "P" }],
				},
			},
		});
		const out = evaluatePracticeGenerationQuality({ questions: [q1, fillerSecondTopic()] });
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("visual_leaks_answer");
	});

	it("fails chunk_alignment_weak when stem lacks overlap with topic corpus", () => {
		const corpus = new Map([
			[
				tid,
				"newtonian mechanics inertia force motion equilibrium laws first second third law applied systems",
			],
		]);
		const q1 = makeQuestion({
			question_number: 1,
			topic_id: tid,
			question_text:
				"Describe quantization in nanoscale plasmonic metamaterials without referring to textbook labels.",
		});
		const out = evaluatePracticeGenerationQuality({
			questions: [q1, fillerSecondTopic()],
			chunkAlignment: { corpusByTopicId: corpus, contextQuality: "ok" },
		});
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.code).toBe("chunk_alignment_weak");
	});

	it("passes chunk gate when stem aligns with corpus", () => {
		const corpus = new Map([
			[
				tid,
				"newtonian mechanics inertia force motion equilibrium laws first second third law applied systems",
			],
		]);
		const q1 = makeQuestion({
			question_number: 1,
			topic_id: tid,
			question_text: "What does inertia describe about motion and force in equilibrium?",
		});
		const out = evaluatePracticeGenerationQuality({
			questions: [q1, fillerSecondTopic()],
			chunkAlignment: { corpusByTopicId: corpus, contextQuality: "ok" },
		});
		expect(out.ok).toBe(true);
	});

	it("skips chunk gate for no_context", () => {
		const corpus = new Map([
			[
				tid,
				"newtonian mechanics inertia force motion equilibrium laws first second third law applied systems",
			],
		]);
		const q1 = makeQuestion({
			question_number: 1,
			topic_id: tid,
			question_text:
				"Describe nanoscale plasmonic quantization unrelated to supplied mechanics text.",
		});
		const out = evaluatePracticeGenerationQuality({
			questions: [q1, fillerSecondTopic()],
			chunkAlignment: { corpusByTopicId: corpus, contextQuality: "no_context" },
		});
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
