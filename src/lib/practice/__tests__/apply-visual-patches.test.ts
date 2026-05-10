import { describe, expect, it } from "vitest";

import { applyVisualPatches } from "../visuals/apply-visual-patches";
import type { PracticeGenerationOutput } from "../generation-schema";

function makeOutput(): PracticeGenerationOutput {
	return {
		questions: [
			{
				question_number: 1,
				topic_id: "11111111-1111-4111-8111-111111111111",
				topic_name: "Topic A",
				question_text: "Solve for x: 2x = 10.",
				question_type: "multiple_choice",
				difficulty_level: "easy",
				options: { A: "3", B: "4", C: "5", D: "6" },
				answer_key: {
					correct_answer: "C",
					explanation: "Original explanation.",
					common_mistakes: [],
					related_concept: "Linear equations",
				},
				estimated_time_seconds: 60,
				visual: null,
			},
		],
		generation_metadata: {
			topic_distribution: {},
			difficulty_distribution: {},
			type_distribution: {},
			adaptation_rationale: "",
		},
	};
}

describe("applyVisualPatches", () => {
	it("nulls a visual via null_visual action", () => {
		const out = makeOutput();
		out.questions[0]!.visual = {
			caption: "Cap",
			altText: "Alt",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1, showGrid: true, showAxes: true },
				primitives: [
					{ type: "point", at: { x: 0, y: 0 }, label: "O" },
				],
			},
		};
		const result = applyVisualPatches(out, [{ action: "null_visual", index: 0 }]);
		expect(result.applied).toBe(1);
		expect(result.output.questions[0]!.visual).toBeNull();
		// Original is untouched.
		expect(out.questions[0]!.visual).not.toBeNull();
	});

	it("rewrites a stem via rewrite_stem action", () => {
		const out = makeOutput();
		const result = applyVisualPatches(out, [
			{ action: "rewrite_stem", index: 0, question_text: "Find x." },
		]);
		expect(result.applied).toBe(1);
		expect(result.output.questions[0]!.question_text).toBe("Find x.");
	});

	it("rewrites the explanation via rewrite_explanation", () => {
		const out = makeOutput();
		const result = applyVisualPatches(out, [
			{ action: "rewrite_explanation", index: 0, explanation: "New text." },
		]);
		expect(result.applied).toBe(1);
		expect(result.output.questions[0]!.answer_key.explanation).toBe("New text.");
	});

	it("replaces a visual via replace_visual when the envelope parses", () => {
		const out = makeOutput();
		const result = applyVisualPatches(out, [
			{
				action: "replace_visual",
				index: 0,
				value: {
					caption: "Cap",
					altText: "Alt",
					spec: {
						kind: "number_line",
						min: 0,
						max: 5,
						tickStep: 1,
						points: [],
						intervals: [],
					},
				},
			},
		]);
		expect(result.applied).toBe(1);
		expect(result.output.questions[0]!.visual?.spec.kind).toBe("number_line");
	});

	it("silently drops malformed replace_visual envelopes", () => {
		const out = makeOutput();
		const result = applyVisualPatches(out, [
			{
				action: "replace_visual",
				index: 0,
				value: { caption: "x", altText: "x", spec: { kind: "non_existent_kind" } },
			},
		]);
		expect(result.applied).toBe(0);
		expect(result.output.questions[0]!.visual).toBeNull();
	});

	it("ignores out-of-range indices", () => {
		const out = makeOutput();
		const result = applyVisualPatches(out, [
			{ action: "null_visual", index: 99 },
			{ action: "null_visual", index: -1 },
		]);
		expect(result.applied).toBe(0);
	});
});
