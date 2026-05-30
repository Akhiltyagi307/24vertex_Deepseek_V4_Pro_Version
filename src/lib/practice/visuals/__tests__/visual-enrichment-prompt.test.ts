import { describe, expect, it } from "vitest";

import type { PracticeGenerationOutput } from "../../generation-schema";
import {
	buildVisualEnrichmentSystemPrompt,
	buildVisualEnrichmentUserPrompt,
} from "../visual-enrichment-prompt";

const OUTPUT: PracticeGenerationOutput = {
	questions: [
		{
			question_number: 1,
			topic_id: "11111111-1111-1111-1111-111111111111",
			topic_name: "Triangles",
			question_text: "Find angle A from the triangle shown.",
			question_type: "multiple_choice",
			difficulty_level: "medium",
			options: { A: "30°", B: "45°", C: "60°", D: "90°" },
			answer_key: {
				correct_answer: "C",
				explanation: "Angle sum is 180.",
				common_mistakes: [],
				related_concept: "triangle angle sum",
			},
			estimated_time_seconds: 90,
			visual: null,
		},
	],
	generation_metadata: {
		topic_distribution: {},
		difficulty_distribution: {},
		type_distribution: {},
		adaptation_rationale: "test",
	},
};

describe("visual-enrichment prompt", () => {
	it("builds strict JSON-only system instructions", () => {
		const system = buildVisualEnrichmentSystemPrompt();
		expect(system).toContain("Output MUST be a raw JSON array");
		expect(system).toContain("replace_visual");
		expect(system).toContain("null_visual");
		expect(system).not.toContain("rewrite_stem");
		expect(system).toContain("Do not rewrite question text or explanations in this pass.");
		expect(system).toContain("self-verify every proposed replace_visual");
		expect(system).toContain("single source of truth for literals");
		expect(system).toContain("Never copy numbers/entities from VISUAL_EXEMPLARS_JSON");
		expect(system).toContain("blueprint_visual_idea");
	});

	it("instructs concept-family routing and a draw-by-default bias", () => {
		const system = buildVisualEnrichmentSystemPrompt();
		expect(system).toContain("kinematics_components");
		expect(system).toContain("chemistry_equilibrium");
		expect(system).toContain("chemistry_lewis");
		// The prompt now biases toward drawing instead of returning null when
		// uncertain — the previous "otherwise return `null_visual` rather than
		// approximating with an unrelated atom/molecule scaffold" tail was
		// drowning the upstream intent-gate decisions and producing very low
		// per-subject visual yield (Class-10 Science fell to 0–2/15).
		expect(system).toContain("Bias to DRAW");
		expect(system).toContain("Skipping criteria");
		expect(system).not.toContain("return `null_visual` rather than approximating");
	});

	it("embeds candidate indexes, allowed kinds and questions", () => {
		const user = buildVisualEnrichmentUserPrompt({
			output: OUTPUT,
			subjectName: "Mathematics",
			preferredKinds: ["math_geometry"],
			candidateIndexes: [0],
			candidateIntent: [
				{
					index: 0,
					priority: "high",
					reason: "blueprint_intent",
					preferred_kind: "math_geometry",
					blueprint_visual_idea: "Labeled triangle with angle A at a vertex.",
				},
			],
			topicEvidence: [
				{
					topic_id: "11111111-1111-1111-1111-111111111111",
					topic_name: "Triangles",
					curriculum_hint: { unit_name: "Geometry", chapter_name: "Triangles", grade: 9 },
					items: [{ ref: "111:content:0", kind: "content", text: "Angle sum theorem", source_ref: null }],
				},
			],
			topicExemplarHint: "triangles geometry",
			requireAtLeastOneVisual: true,
		});
		expect(user).toContain("VISUAL_ENRICHMENT_INPUT:");
		expect(user).toContain(`"candidate_indexes":[0]`);
		expect(user).toContain(`"allowed_visual_kinds":["math_geometry"]`);
		expect(user).toContain(`"candidate_question_bundles":[`);
		expect(user).toContain(`"require_at_least_one_visual":true`);
		expect(user).toContain(`"strict_grounding":true`);
		expect(user).toContain("VISUAL_EXEMPLARS_JSON:");
		expect(user).toContain("blueprint_visual_idea");
		expect(user).toContain("Labeled triangle with angle A at a vertex.");
	});

	it("embeds template policy when supplied", () => {
		const user = buildVisualEnrichmentUserPrompt({
			output: OUTPUT,
			subjectName: "Chemistry",
			preferredKinds: ["chemistry_cell_diagram"],
			candidateIndexes: [0],
			candidateIntent: [],
			topicEvidence: [],
			templatePolicy: {
				enabled: true,
				templates: [
					{
						id: "chemistry-galvanic-cell",
						kind: "chemistry_cell_diagram",
						required_slots: ["anode", "cathode", "electronFlow"],
						optional_slots: ["saltBridge"],
						constraints: ["Anode/cathode polarity must match the cell type."],
					},
				],
				prompt_brief: "Visual template engine: choose chemistry-galvanic-cell.",
			},
		});

		expect(user).toContain(`"template_policy"`);
		expect(user).toContain("chemistry-galvanic-cell");
		expect(user).toContain("Visual template engine");
	});
});
