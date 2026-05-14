import { describe, expect, it } from "vitest";

import {
	buildPracticeEvidenceMap,
	selectEvidenceByTopicIds,
	selectEvidenceForFailedIndexes,
} from "../generation-evidence-pack";
import type { PracticeGenerationOutput } from "../generation-schema";
import type { PracticeTopicGrounding } from "../user-message";

const TOPIC_GROUNDING: PracticeTopicGrounding[] = [
	{
		topic_id: "11111111-1111-1111-1111-111111111111",
		topic_name: "Linear Equations",
		curriculum_hint: { unit_name: "Algebra", chapter_name: "Equations", grade: 9 },
		content_chunks: [
			{ text: "Solve ax + b = c by isolating x.", source_ref: "c1" },
			{ text: "Check solution by substitution.", source_ref: "c2" },
		],
		exercise_chunks: [{ text: "2x + 3 = 11", source_ref: "e1" }],
		question_bank_chunks: [{ text: "If 3x - 4 = 8, find x.", source_ref: "qb1" }],
	},
	{
		topic_id: "22222222-2222-2222-2222-222222222222",
		topic_name: "Triangles",
		curriculum_hint: { unit_name: "Geometry", chapter_name: "Triangles", grade: 9 },
		content_chunks: [{ text: "Angles in a triangle sum to 180 degrees.", source_ref: "c3" }],
		exercise_chunks: [],
		question_bank_chunks: [],
	},
];

describe("generation-evidence-pack", () => {
	it("builds stable evidence refs per topic", () => {
		const map = buildPracticeEvidenceMap(TOPIC_GROUNDING);
		const eq = map.get("11111111-1111-1111-1111-111111111111");
		expect(eq?.items.map((x) => x.ref)).toEqual([
			"11111111-1111-1111-1111-111111111111:content:0",
			"11111111-1111-1111-1111-111111111111:content:1",
			"11111111-1111-1111-1111-111111111111:exercise:0",
			"11111111-1111-1111-1111-111111111111:question_bank:0",
		]);
	});

	it("selects evidence by explicit topic ids", () => {
		const map = buildPracticeEvidenceMap(TOPIC_GROUNDING);
		const selected = selectEvidenceByTopicIds(map, ["22222222-2222-2222-2222-222222222222"]);
		expect(selected).toHaveLength(1);
		expect(selected[0]?.topic_name).toBe("Triangles");
	});

	it("selects evidence for failed question indexes", () => {
		const map = buildPracticeEvidenceMap(TOPIC_GROUNDING);
		const output = {
			questions: [
				{
					question_number: 1,
					topic_id: "11111111-1111-1111-1111-111111111111",
					topic_name: "Linear Equations",
					question_text: "Solve 2x + 3 = 11",
					question_type: "multiple_choice",
					difficulty_level: "easy",
					options: { A: "2", B: "3", C: "4", D: "5" },
					answer_key: {
						correct_answer: "C",
						explanation: "2x=8",
						common_mistakes: [],
						related_concept: "equations",
					},
					estimated_time_seconds: 60,
					visual: null,
				},
				{
					question_number: 2,
					topic_id: "22222222-2222-2222-2222-222222222222",
					topic_name: "Triangles",
					question_text: "Sum of interior angles in triangle?",
					question_type: "fill_in_blank",
					difficulty_level: "easy",
					options: null,
					answer_key: {
						correct_answer: "180",
						explanation: "Triangle angle sum theorem",
						common_mistakes: [],
						related_concept: "triangles",
					},
					estimated_time_seconds: 45,
					visual: null,
				},
			],
			generation_metadata: {
				topic_distribution: {},
				difficulty_distribution: {},
				type_distribution: {},
				adaptation_rationale: "",
			},
		} satisfies PracticeGenerationOutput;

		const selected = selectEvidenceForFailedIndexes(map, output.questions, [1]);
		expect(selected).toHaveLength(1);
		expect(selected[0]?.topic_id).toBe("22222222-2222-2222-2222-222222222222");
	});
});
