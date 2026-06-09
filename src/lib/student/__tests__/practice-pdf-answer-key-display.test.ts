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

	// Teacher-authored (manual) keys omit the AI-only explanation/common_mistakes/
	// related_concept fields, so they fail practiceAnswerKeySchema. They must still
	// render readable text — never a raw JSON blob.
	it("formats a manual MCQ key (no AI fields) without dumping raw JSON", () => {
		const out = formatGenerationAnswerForPdf({
			questionType: "multiple_choice",
			options: { A: "3", B: "4" },
			answerKeyJson: { correct_answer: "B" },
		});
		expect(out).toContain("Correct answer: B");
		expect(out).toContain("4");
		expect(out).not.toContain("{");
	});

	it("formats a manual numerical key with units and tolerance", () => {
		const out = formatGenerationAnswerForPdf({
			questionType: "numerical",
			options: null,
			answerKeyJson: { correct_answer: "9.8", units: "m/s²", tolerance: 0.1 },
		});
		expect(out).toContain("Correct answer: 9.8");
		expect(out).toContain("Units: m/s²");
		expect(out).toContain("Tolerance: ±0.1");
		expect(out).not.toContain("{");
	});

	it("formats a manual open-ended key (model answer + marking points)", () => {
		const out = formatGenerationAnswerForPdf({
			questionType: "short_answer",
			options: null,
			answerKeyJson: {
				model_answer: "Resists change in motion",
				marking_points: ["Mentions resistance", "Links to mass"],
			},
		});
		expect(out).toContain("Model answer");
		expect(out).toContain("Resists change in motion");
		expect(out).toContain("Marking points");
		expect(out).toContain("• Mentions resistance");
		expect(out).not.toContain("{");
	});

	it("formats a manual fill-in-the-blank key with accepted variants", () => {
		const out = formatGenerationAnswerForPdf({
			questionType: "fill_in_blank",
			options: null,
			answerKeyJson: { correct_answer: "photosynthesis", acceptable_variants: ["Photosynthesis"] },
		});
		expect(out).toContain("Correct answer: photosynthesis");
		expect(out).toContain("Also accepted: Photosynthesis");
		expect(out).not.toContain("{");
	});
});
