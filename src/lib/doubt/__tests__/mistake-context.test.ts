import { describe, expect, it } from "vitest";

import { formatMistakeBlock } from "@/lib/doubt/mistake-context";

describe("formatMistakeBlock", () => {
	it("renders the student answer, reference, and feedback", () => {
		const block = formatMistakeBlock({
			questionText: "What is 1/2 + 1/4?",
			studentAnswerSummary: "Said 2/6",
			referenceAnswerSummary: "3/4",
			feedback: "Find a common denominator first.",
		});
		expect(block).toContain("What is 1/2 + 1/4?");
		expect(block).toContain("Said 2/6");
		expect(block).toContain("3/4");
		expect(block).toContain("common denominator");
	});

	it("keeps the question even when other parts are missing", () => {
		expect(
			formatMistakeBlock({
				questionText: "Q",
				studentAnswerSummary: null,
				referenceAnswerSummary: null,
				feedback: null,
			}),
		).toContain("Q");
	});

	it("returns null when there is nothing to ground on", () => {
		expect(
			formatMistakeBlock({
				questionText: null,
				studentAnswerSummary: null,
				referenceAnswerSummary: null,
				feedback: null,
			}),
		).toBeNull();
	});
});
