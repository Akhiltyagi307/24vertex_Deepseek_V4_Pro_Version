import { describe, expect, it } from "vitest";

import { cosineSimilarity } from "@/lib/ai/moderation";

describe("moderation embedding blacklist", () => {
	it("treats identical 1536-d vectors as cosine 1", () => {
		const v = Array.from({ length: 1536 }, () => Math.random());
		expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
	});

	it("flags cosine >= 0.95 for near-parallel vectors", () => {
		const base = Array.from({ length: 1536 }, (_, i) => (i % 7 === 0 ? 1 : 0.1));
		const noise = base.map((x) => x * 0.999 + 0.0001);
		expect(cosineSimilarity(base, noise)).toBeGreaterThanOrEqual(0.95);
	});

	it("returns 0 for length mismatch", () => {
		expect(cosineSimilarity([1, 2], [1])).toBe(0);
	});
});
