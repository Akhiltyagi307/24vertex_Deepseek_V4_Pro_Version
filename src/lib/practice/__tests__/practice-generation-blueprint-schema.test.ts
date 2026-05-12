import { describe, expect, it } from "vitest";

import {
	createPracticeGenerationBlueprintSchema,
	flattenPracticeGenerationBlueprint,
	validatePracticeGenerationBlueprint,
} from "../practice-generation-blueprint-schema";

describe("practice-generation-blueprint-schema", () => {
	const expectedCounts = {
		multiple_choice: 1,
		fill_in_blank: 1,
		short_answer: 0,
		long_answer: 0,
	};

	it("enforces exact per-type slot lengths", () => {
		const schema = createPracticeGenerationBlueprintSchema(expectedCounts);
		const parsed = schema.safeParse({
			slots_by_type: {
				multiple_choice: [],
				fill_in_blank: [
					{
						slot_id: "q1",
						topic_id: "11111111-1111-1111-1111-111111111111",
						question_type: "fill_in_blank",
						difficulty_level: "easy",
						skill_target: "definition recall",
						evidence_refs: [],
						visual_intent: null,
					},
				],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});
		expect(parsed.success).toBe(false);
	});

	it("flattens grouped slots in stable bucket order", () => {
		const schema = createPracticeGenerationBlueprintSchema(expectedCounts);
		const grouped = schema.parse({
			slots_by_type: {
				multiple_choice: [
					{
						slot_id: "q1",
						topic_id: "11111111-1111-1111-1111-111111111111",
						question_type: "multiple_choice",
						difficulty_level: "easy",
						skill_target: "solve linear equation",
						evidence_refs: ["111:content:0"],
						visual_intent: null,
					},
				],
				fill_in_blank: [
					{
						slot_id: "q2",
						topic_id: "22222222-2222-2222-2222-222222222222",
						question_type: "fill_in_blank",
						difficulty_level: "medium",
						skill_target: "triangle angle sum",
						evidence_refs: ["222:content:0"],
						visual_intent: {
							needs_visual: false,
							priority: "none",
							preferred_kind: null,
							reason: null,
							visual_idea: null,
							required: false,
							purpose: null,
						},
					},
				],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});

		const flat = flattenPracticeGenerationBlueprint(grouped);
		expect(flat.map((s) => s.slot_id)).toEqual(["q1", "q2"]);
	});

	it("rejects disallowed topic ids at validation stage", () => {
		const schema = createPracticeGenerationBlueprintSchema(expectedCounts);
		const blueprint = schema.parse({
			slots_by_type: {
				multiple_choice: [
					{
						slot_id: "q1",
						topic_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
						question_type: "multiple_choice",
						difficulty_level: "easy",
						skill_target: "skill",
						evidence_refs: [],
						visual_intent: null,
					},
				],
				fill_in_blank: [
					{
						slot_id: "q2",
						topic_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
						question_type: "fill_in_blank",
						difficulty_level: "easy",
						skill_target: "skill",
						evidence_refs: [],
						visual_intent: null,
					},
				],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});

		const check = validatePracticeGenerationBlueprint({
			blueprint,
			allowedTopicIds: new Set(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]),
			expectedTypeCounts: expectedCounts,
		});
		expect(check.ok).toBe(false);
	});

	it("canonicalizes a one-character topic id typo when there is one unique allowed match", () => {
		const schema = createPracticeGenerationBlueprintSchema(expectedCounts);
		const canonicalTopicId = "b60b3ecb-df9b-40ac-b7d7-2994c05f7c46";
		const blueprint = schema.parse({
			slots_by_type: {
				multiple_choice: [
					{
						slot_id: "q1",
						topic_id: "b60b3ecb-df9d-40ac-b7d7-2994c05f7c46",
						question_type: "multiple_choice",
						difficulty_level: "easy",
						skill_target: "skill",
						evidence_refs: [],
						visual_intent: null,
					},
				],
				fill_in_blank: [
					{
						slot_id: "q2",
						topic_id: canonicalTopicId,
						question_type: "fill_in_blank",
						difficulty_level: "easy",
						skill_target: "skill",
						evidence_refs: [],
						visual_intent: null,
					},
				],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});

		const check = validatePracticeGenerationBlueprint({
			blueprint,
			allowedTopicIds: new Set([canonicalTopicId]),
			expectedTypeCounts: expectedCounts,
		});
		expect(check.ok).toBe(true);
		expect(blueprint.slots_by_type.multiple_choice[0]?.topic_id).toBe(canonicalTopicId);
	});

	const soloMcqCounts = {
		multiple_choice: 1,
		fill_in_blank: 0,
		short_answer: 0,
		long_answer: 0,
	};

	it("rejects needs_visual without a substantive visual_idea when visual policy is on", () => {
		const schema = createPracticeGenerationBlueprintSchema(soloMcqCounts);
		const blueprint = schema.parse({
			slots_by_type: {
				multiple_choice: [
					{
						slot_id: "q1",
						topic_id: "11111111-1111-1111-1111-111111111111",
						question_type: "multiple_choice",
						difficulty_level: "easy",
						skill_target: "read table",
						evidence_refs: [],
						visual_intent: {
							needs_visual: true,
							priority: "high",
							preferred_kind: "data_table",
							reason: "data",
							visual_idea: "   ",
							required: true,
							purpose: null,
						},
					},
				],
				fill_in_blank: [],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});

		const check = validatePracticeGenerationBlueprint({
			blueprint,
			allowedTopicIds: new Set(["11111111-1111-1111-1111-111111111111"]),
			expectedTypeCounts: soloMcqCounts,
			visualPolicy: { enabled: true, preferredKinds: ["data_table"] },
		});
		expect(check.ok).toBe(false);
	});

	it("accepts needs_visual when visual_idea and preferred_kind match visual policy", () => {
		const schema = createPracticeGenerationBlueprintSchema(soloMcqCounts);
		const blueprint = schema.parse({
			slots_by_type: {
				multiple_choice: [
					{
						slot_id: "q1",
						topic_id: "11111111-1111-1111-1111-111111111111",
						question_type: "multiple_choice",
						difficulty_level: "easy",
						skill_target: "compare resistivity",
						evidence_refs: [],
						visual_intent: {
							needs_visual: true,
							priority: "high",
							preferred_kind: "data_table",
							reason: "tabular",
							visual_idea: "Small two-column table: material vs resistivity at 300 K.",
							required: true,
							purpose: null,
						},
					},
				],
				fill_in_blank: [],
				short_answer: [],
				long_answer: [],
			},
			notes: null,
		});

		const check = validatePracticeGenerationBlueprint({
			blueprint,
			allowedTopicIds: new Set(["11111111-1111-1111-1111-111111111111"]),
			expectedTypeCounts: soloMcqCounts,
			visualPolicy: { enabled: true, preferredKinds: ["data_table", "math_function_plot"] },
		});
		expect(check.ok).toBe(true);
	});
});
