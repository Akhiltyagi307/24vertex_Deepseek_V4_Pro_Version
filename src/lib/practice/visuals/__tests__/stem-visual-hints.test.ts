import { describe, expect, it } from "vitest";

import { STEM_NEEDS_VISUAL_HINT, stemNeedsVisualHint } from "../stem-visual-hints";

describe("stem-visual-hints", () => {
	it("matches chemistry stems where “shown” and “below” are split by “in the equation”", () => {
		expect(stemNeedsVisualHint("Balance the reaction shown in the equation below.")).toBe(true);
		expect(stemNeedsVisualHint("Name the product in the balanced chemical equation below.")).toBe(true);
	});

	it("matches explicit figure / diagram / table / graph / circuit cues", () => {
		expect(stemNeedsVisualHint("Find the slope in the figure shown.")).toBe(true);
		expect(stemNeedsVisualHint("In the figure shown above, find the slope of segment AB.")).toBe(true);
		expect(stemNeedsVisualHint("Shown below is a circuit with a 12 V battery.")).toBe(true);
		expect(stemNeedsVisualHint("For the circuit shown below, find the equivalent resistance.")).toBe(true);
		expect(stemNeedsVisualHint("Refer to the table and compute the mean.")).toBe(true);
		expect(stemNeedsVisualHint("Based on the graph, identify the year with peak GDP growth.")).toBe(true);
		expect(stemNeedsVisualHint("Study the diagram and label the chloroplast.")).toBe(true);
	});

	it("matches passage / following-block cues used in English and SS papers", () => {
		expect(stemNeedsVisualHint("Read the following passage and answer the questions.")).toBe(true);
		expect(stemNeedsVisualHint("Read the passage given below carefully.")).toBe(true);
		expect(stemNeedsVisualHint("The passage below describes an ecosystem.")).toBe(true);
	});

	it("does not match plain arithmetic or definitional stems without stimulus cues", () => {
		expect(stemNeedsVisualHint("Compute 2 + 2 without referencing a diagram.")).toBe(false);
		expect(stemNeedsVisualHint("What is the SI unit of power?")).toBe(false);
		expect(stemNeedsVisualHint("Define photosynthesis in one sentence.")).toBe(false);
	});

	it("does not match MCQ boilerplate that used to false-trigger on bare “below/above”", () => {
		expect(stemNeedsVisualHint("Select the correct answer from the options below.")).toBe(false);
		expect(stemNeedsVisualHint("Choose the best option from the choices below.")).toBe(false);
		expect(stemNeedsVisualHint("Answer the questions given below in one word each.")).toBe(false);
		expect(stemNeedsVisualHint("Which of the following statements is true?")).toBe(false);
		expect(stemNeedsVisualHint("The statement above refers to fiscal policy.")).toBe(false);
	});

	it("exports a stable regex for documentation parity", () => {
		expect(STEM_NEEDS_VISUAL_HINT.flags).toBe("i");
		expect(STEM_NEEDS_VISUAL_HINT.source).toContain("figure");
	});
});
