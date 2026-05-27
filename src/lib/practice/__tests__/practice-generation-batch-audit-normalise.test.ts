import { describe, expect, it } from "vitest";

import { normalizePracticeGenerationArtifacts } from "../practice-generation-batch-audit";
import type { GeneratedPracticeQuestion } from "../generation-schema";

function mcq(args: {
	correct: "A" | "B" | "C" | "D";
	rationale: Partial<Record<"A" | "B" | "C" | "D", string>>;
}): GeneratedPracticeQuestion {
	return {
		question_number: 1,
		topic_id: "00000000-0000-0000-0000-000000000000",
		topic_name: "topic",
		question_text: "stem",
		question_type: "multiple_choice",
		difficulty_level: "easy",
		options: { A: "a", B: "b", C: "c", D: "d" },
		answer_key: {
			correct_answer: args.correct,
			explanation: "x",
			common_mistakes: [],
			related_concept: "x",
			distractor_rationale: args.rationale as never,
		},
		estimated_time_seconds: 30,
		visual: null,
	} as GeneratedPracticeQuestion;
}

describe("normalizePracticeGenerationArtifacts", () => {
	it("strips duplicate ALL-CAPS CORRECT labels from off-letter rationales (keyed letter wins)", () => {
		const q = mcq({
			correct: "B",
			rationale: {
				A: "CORRECT — picked A by mistake",
				B: "CORRECT — applied F = μN",
				C: "SURFACE-PLAUSIBILITY — wrong shape",
				D: "PARTIAL-KNOWLEDGE — half right",
			},
		});
		const out = normalizePracticeGenerationArtifacts([q]);
		expect(out.mcq_duplicate_correct_label_fixes).toBe(1);
		const dr = q.answer_key.distractor_rationale!;
		// Keyed letter retains "CORRECT"
		expect(dr.B).toMatch(/\bCORRECT\b/);
		// Off-letter A no longer has the ALL-CAPS CORRECT tag.
		expect(dr.A).not.toMatch(/\bCORRECT\b/);
		// A gets a fallback archetype tag because none was present.
		expect(dr.A!.startsWith("COMMON-ERROR") || dr.A!.startsWith("PARTIAL-KNOWLEDGE") || dr.A!.startsWith("SURFACE-PLAUSIBILITY")).toBe(true);
	});

	it("is idempotent — single CORRECT label triggers no fixes", () => {
		const q = mcq({
			correct: "C",
			rationale: {
				A: "COMMON-ERROR — typical slip",
				B: "PARTIAL-KNOWLEDGE — half right",
				C: "CORRECT — keyed answer",
				D: "SURFACE-PLAUSIBILITY — wrong shape",
			},
		});
		const out = normalizePracticeGenerationArtifacts([q]);
		expect(out.mcq_duplicate_correct_label_fixes).toBe(0);
		expect(q.answer_key.distractor_rationale!.C).toMatch(/\bCORRECT\b/);
	});

	it("preserves lower-case 'correctly' inside off-letter rationales", () => {
		const q = mcq({
			correct: "A",
			rationale: {
				A: "CORRECT — keyed answer",
				B: "CORRECT — student incorrectly applied rule",
				C: "PARTIAL-KNOWLEDGE — half right",
				D: "SURFACE-PLAUSIBILITY — looks right",
			},
		});
		normalizePracticeGenerationArtifacts([q]);
		// B's ALL-CAPS CORRECT is stripped, "incorrectly" survives.
		expect(q.answer_key.distractor_rationale!.B).not.toMatch(/\bCORRECT\b/);
		expect(q.answer_key.distractor_rationale!.B).toMatch(/incorrectly/);
	});

	it("ignores non-MCQ items", () => {
		const fib = {
			...mcq({ correct: "A", rationale: { A: "CORRECT", B: "CORRECT" } }),
			question_type: "fill_in_blank" as const,
			options: null,
		} as GeneratedPracticeQuestion;
		const out = normalizePracticeGenerationArtifacts([fib]);
		expect(out.mcq_duplicate_correct_label_fixes).toBe(0);
	});

	it("never introduces a duplicate archetype across off-letters when picking a fallback", () => {
		const q = mcq({
			correct: "D",
			rationale: {
				A: "CORRECT — off-letter spurious",
				B: "CORRECT — also spurious",
				C: "PARTIAL-KNOWLEDGE — only this archetype present",
				D: "CORRECT — keyed",
			},
		});
		normalizePracticeGenerationArtifacts([q]);
		const dr = q.answer_key.distractor_rationale!;
		// Off-letters A and B should get fallback archetypes, and neither should be
		// PARTIAL-KNOWLEDGE (since C already has it).
		const archetypes = ["COMMON-ERROR", "PARTIAL-KNOWLEDGE", "SURFACE-PLAUSIBILITY"];
		const a_arch = archetypes.find((t) => dr.A!.includes(t));
		const b_arch = archetypes.find((t) => dr.B!.includes(t));
		expect(a_arch).toBeDefined();
		expect(b_arch).toBeDefined();
		expect(a_arch).not.toBe(b_arch);
	});
});
