import { describe, expect, it } from "vitest";

import type { PracticeGenerationOutput } from "../../generation-schema";
import type { PracticeGenerationBlueprintSlot } from "../../practice-generation-blueprint-schema";
import {
	resolveQuestionVisualIntent,
	selectVisualCandidateIndexes,
	shouldRequireAtLeastOneVisual,
} from "../visual-intent";

function makeQuestion(
	questionText: string,
	questionType: PracticeGenerationOutput["questions"][number]["question_type"] = "multiple_choice",
): PracticeGenerationOutput["questions"][number] {
	return {
		question_number: 1,
		topic_id: "11111111-1111-1111-1111-111111111111",
		topic_name: "Topic",
		question_text: questionText,
		question_type: questionType,
		difficulty_level: "easy",
		options:
			questionType === "multiple_choice" ?
				{
					A: "A",
					B: "B",
					C: "C",
					D: "D",
				}
			:	null,
		answer_key: {
			correct_answer: questionType === "multiple_choice" ? "A" : "42",
			explanation: "Because of the concept.",
			common_mistakes: [],
			related_concept: "Concept",
		},
		estimated_time_seconds: 60,
		visual: null,
	};
}

function makeSlot(
	slotId: string,
	questionType: PracticeGenerationBlueprintSlot["question_type"],
	visualIntent: PracticeGenerationBlueprintSlot["visual_intent"],
): PracticeGenerationBlueprintSlot {
	return {
		slot_id: slotId,
		topic_id: "11111111-1111-1111-1111-111111111111",
		question_type: questionType,
		difficulty_level: "easy",
		skill_target: "Skill",
		evidence_refs: [],
		visual_intent: visualIntent,
	};
}

describe("visual intent decisions", () => {
	it("marks explicit figure references as necessary", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [makeQuestion("Using the graph shown below, find the slope.")],
			blueprintSlots: [makeSlot("q1", "multiple_choice", null)],
			allowedKinds: ["math_function_plot", "data_table"],
		});
		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "necessary",
			reason: "explicit_instruction",
		});
	});

	it("keeps blueprint high-priority questions visual when stem is neutral", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [makeQuestion("Solve the equation for x.")],
			blueprintSlots: [
				makeSlot("q1", "multiple_choice", {
					needs_visual: true,
					priority: "high",
					preferred_kind: "data_table",
					reason: "trend_or_data",
					visual_idea: null,
					required: true,
					purpose: "tabulate values",
				}),
			],
			allowedKinds: ["data_table"],
		});
		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "blueprint_intent",
			preferredKind: "data_table",
		});
	});

	it("keeps blueprint medium hints eligible", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [makeQuestion("Solve the equation for x.")],
			blueprintSlots: [
				makeSlot("q1", "multiple_choice", {
					needs_visual: true,
					priority: "medium",
					preferred_kind: "data_table",
					reason: "trend_or_data",
					visual_idea: null,
					required: true,
					purpose: "tabulate values",
				}),
			],
			allowedKinds: ["data_table"],
		});
		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "medium",
			reason: "blueprint_intent",
			preferredKind: "data_table",
		});
	});

	it("treats relationship wording as visual-friendly trend/data intent", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [makeQuestion("Study the relationship between temperature and pressure.")],
			blueprintSlots: [makeSlot("q1", "multiple_choice", null)],
			allowedKinds: ["statistics_chart", "data_table"],
		});
		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "trend_or_data",
		});
	});

	it("routes new template-engine cue words to the richest allowed visual family", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [
				makeQuestion("Use the electric field lines shown below to identify the field direction."),
				makeQuestion("Read the source extract and identify the constitutional principle."),
				makeQuestion("Use the timeline to infer the sequence of events."),
			],
			blueprintSlots: [
				makeSlot("q1", "multiple_choice", null),
				makeSlot("q2", "multiple_choice", null),
				makeSlot("q3", "multiple_choice", null),
			],
			allowedKinds: ["physics_field_diagram", "source_extract", "timeline", "data_table"],
		});

		expect(decisions[0]).toMatchObject({ needsVisual: true, preferredKind: "physics_field_diagram" });
		expect(decisions[1]).toMatchObject({ needsVisual: true, preferredKind: "source_extract" });
		expect(decisions[2]).toMatchObject({ needsVisual: true, preferredKind: "timeline" });
	});

	it("marks gravitation geometry stems as high-value math geometry candidates", () => {
		const stems = [
			"For a small height h above Earth, the approximate factor multiplying g is ______.",
			"Derive the expression for gravitational acceleration at depth d below Earth’s surface.",
			"A body is halfway down to Earth’s centre. If it weighed 250 N on the surface, what is its weight there?",
			"Derive the escape-speed formula for Earth and explain the physical meaning of the result.",
			"In the two-sphere example, why is it enough for the projectile to reach the neutral point N?",
		];
		const decisions = resolveQuestionVisualIntent({
			questions: stems.map((stem) => makeQuestion(stem)),
			blueprintSlots: stems.map((_, index) => makeSlot(`q${index + 1}`, "multiple_choice", null)),
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
		});

		expect(decisions).toHaveLength(stems.length);
		for (const decision of decisions) {
			expect(decision).toMatchObject({
				needsVisual: true,
				priority: "high",
				reason: "gravitation_geometry",
				preferredKind: "math_geometry",
			});
		}
	});

	it("routes kinematics component stems away from generic free-body diagrams", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [
				makeQuestion("A projectile is launched with initial velocity components v0x and v0y. Which statement is correct?"),
				makeQuestion("For constant acceleration in the x-direction, the velocity relation is v_x = ______."),
			],
			blueprintSlots: [
				makeSlot("q1", "multiple_choice", null),
				makeSlot("q2", "fill_in_blank", null),
			],
			allowedKinds: ["physics_diagram", "math_geometry", "math_function_plot", "data_table"],
		});

		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "kinematics_components",
			preferredKind: "math_geometry",
		});
		expect(decisions[1]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "kinematics_components",
			preferredKind: "math_geometry",
		});
	});

	it("routes chemistry equilibrium and Lewis stems to distinct concept families", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [
				makeQuestion("For BaSO4(s) ⇌ Ba2+(aq) + SO4 2-(aq), the solubility product expression is ______."),
				makeQuestion("Which statement best explains the Lewis picture of bond formation in Cl2?"),
			],
			blueprintSlots: [
				makeSlot("q1", "fill_in_blank", null),
				makeSlot("q2", "multiple_choice", null),
			],
			allowedKinds: ["chemistry_reaction", "chemistry_molecule", "data_table"],
		});

		expect(decisions[0]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "chemistry_equilibrium",
			preferredKind: "chemistry_reaction",
		});
		expect(decisions[1]).toMatchObject({
			needsVisual: true,
			priority: "high",
			reason: "chemistry_lewis",
			preferredKind: "chemistry_molecule",
		});
	});

	it("keeps pure recall items non-visual by default", () => {
		const decisions = resolveQuestionVisualIntent({
			questions: [makeQuestion("Define osmosis.", "short_answer")],
			blueprintSlots: [makeSlot("q1", "short_answer", null)],
			allowedKinds: ["data_table"],
		});
		expect(decisions[0]).toMatchObject({
			needsVisual: false,
			priority: "none",
		});
	});
});

describe("visual intent candidate selection", () => {
	it("prioritizes necessary first and then high-priority blueprint items", () => {
		const questions = [
			makeQuestion("Using the figure shown below, identify angle ABC."),
			makeQuestion("Solve for x."),
			makeQuestion("List the values from the data."),
		];
		const slots: PracticeGenerationBlueprintSlot[] = [
			makeSlot("q1", "multiple_choice", null),
			makeSlot("q2", "multiple_choice", {
				needs_visual: true,
				priority: "high",
				preferred_kind: "data_table",
				reason: "trend_or_data",
				visual_idea: null,
				required: true,
				purpose: "tabulate values",
			}),
			makeSlot("q3", "short_answer", {
				needs_visual: true,
				priority: "medium",
				preferred_kind: "data_table",
				reason: "trend_or_data",
				visual_idea: null,
				required: true,
				purpose: "tabulate values",
			}),
		];
		const decisions = resolveQuestionVisualIntent({
			questions,
			blueprintSlots: slots,
			allowedKinds: ["math_geometry", "data_table"],
		});

		const initial = selectVisualCandidateIndexes({
			round: "initial",
			questions,
			decisions,
		});
		const retry1 = selectVisualCandidateIndexes({
			round: "retry_1",
			questions,
			decisions,
		});
		const retry2 = selectVisualCandidateIndexes({
			round: "retry_2",
			questions,
			decisions,
		});

		expect(initial).toEqual([0]);
		expect(retry1).toEqual([0, 1]);
		expect(retry2).toEqual([0, 1, 2]);
		expect(shouldRequireAtLeastOneVisual(initial, decisions)).toBe(true);
		expect(shouldRequireAtLeastOneVisual([1], decisions)).toBe(true);
	});
});
