import { describe, expect, it } from "vitest";

import { buildScopeVocab, userTurnLikelyOutOfScope } from "@/lib/doubt/scope-precheck";

const PHOTOSYNTHESIS_CHUNK = `
Photosynthesis is the process by which green plants and some other organisms
convert light energy into chemical energy. The chloroplast contains chlorophyll
which absorbs light. Plants take in carbon dioxide and water and produce
glucose and oxygen. The overall equation: 6 CO2 + 6 H2O -> C6H12O6 + 6 O2.
`;

describe("scope-precheck", () => {
	it("flags a confidently off-topic, long turn as out of scope", () => {
		const vocab = buildScopeVocab(PHOTOSYNTHESIS_CHUNK);
		const v = userTurnLikelyOutOfScope(
			"Can you solve this trigonometry problem with sine and cosine identities for me",
			vocab,
		);
		expect(v.ok).toBe(false);
		if (!v.ok) {
			expect(v.code).toBe("off_topic_no_vocab_overlap");
		}
	});

	it("passes when at least one content word overlaps the vocabulary", () => {
		const vocab = buildScopeVocab(PHOTOSYNTHESIS_CHUNK);
		const v = userTurnLikelyOutOfScope(
			"I keep forgetting what chlorophyll actually does in this process",
			vocab,
		);
		expect(v.ok).toBe(true);
	});

	it("does not block short turns even with zero overlap", () => {
		const vocab = buildScopeVocab(PHOTOSYNTHESIS_CHUNK);
		const v = userTurnLikelyOutOfScope("ok", vocab);
		expect(v.ok).toBe(true);
	});

	it("does not block conversational follow-ups (few content tokens)", () => {
		const vocab = buildScopeVocab(PHOTOSYNTHESIS_CHUNK);
		// "What does that mean" — short content (only "mean" survives filters)
		const v = userTurnLikelyOutOfScope("Wait what does that actually mean", vocab);
		expect(v.ok).toBe(true);
	});

	it("does not block when the vocabulary is empty (no chunks loaded)", () => {
		const v = userTurnLikelyOutOfScope(
			"A long question about quadratic equations and the discriminant formula application here",
			new Set(),
		);
		expect(v.ok).toBe(true);
	});

	it("treats tokens case-insensitively", () => {
		const vocab = buildScopeVocab(PHOTOSYNTHESIS_CHUNK);
		const v = userTurnLikelyOutOfScope(
			"What is CHLOROPHYLL and how does it absorb LIGHT in plant cells",
			vocab,
		);
		expect(v.ok).toBe(true);
	});
});
