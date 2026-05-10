import { describe, expect, it } from "vitest";

import { STEM_NEEDS_VISUAL_HINT, stemNeedsVisualHint } from "../stem-visual-hints";

describe("stem-visual-hints", () => {
	it("matches the eval/quality-gate shared pattern for figure references", () => {
		expect(stemNeedsVisualHint("Find the slope in the figure shown.")).toBe(true);
		expect(stemNeedsVisualHint("Shown below is a circuit with a 12 V battery.")).toBe(true);
		expect(stemNeedsVisualHint("Compute 2 + 2 without referencing a diagram.")).toBe(false);
	});

	it("exports a stable regex for documentation parity", () => {
		expect(STEM_NEEDS_VISUAL_HINT.flags).toBe("i");
		expect(STEM_NEEDS_VISUAL_HINT.source).toContain("figure");
	});
});
