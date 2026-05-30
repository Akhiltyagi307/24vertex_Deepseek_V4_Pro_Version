import { describe, expect, it } from "vitest";

import { formatGenerationAnswerForPdf } from "../practice-pdf-answer-key-display";

describe("formatGenerationAnswerForPdf", () => {
	it("normalizes malformed KaTeX in explanation for display", () => {
		const out = formatGenerationAnswerForPdf({
			questionType: "multiple_choice",
			options: { B: "0 J", A: "5 J", C: "25 J", D: "50 J" },
			answerKeyJson: {
				correct_answer: "B",
				explanation:
					"Therefore, work done = forc$e \\times displacement = 5$ $N \\times 0$ m = 0 J.",
				common_mistakes: [],
				related_concept: "Condition for work",
			},
		});
		expect(out).toContain("Explanation");
		expect(out).toContain("$force \\times displacement = 5 N \\times 0$");
		expect(out).not.toContain("forc$e");
	});
});
