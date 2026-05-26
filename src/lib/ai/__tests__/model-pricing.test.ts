import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeCostInr } from "../model-pricing";

describe("computeCostInr", () => {
	const ORIGINAL_RATE = process.env.AI_COST_USD_TO_INR;

	beforeEach(() => {
		delete process.env.AI_COST_USD_TO_INR;
	});

	afterEach(() => {
		if (ORIGINAL_RATE === undefined) delete process.env.AI_COST_USD_TO_INR;
		else process.env.AI_COST_USD_TO_INR = ORIGINAL_RATE;
	});

	it("returns null for an unknown model", () => {
		expect(computeCostInr("some-future-model", 1000, 1000)).toBeNull();
	});

	it("computes gpt-4o-mini at known price (default 83 INR/USD)", () => {
		// 1M input @ $0.15 + 1M output @ $0.60 = $0.75 = 0.75 * 83 = 62.25 INR
		expect(computeCostInr("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(62.25, 4);
	});

	it("computes gpt-5.4-mini correctly for a typical generation", () => {
		// 8000 input + 4000 output, gpt-5.4-mini: $0.25/M in, $1.0/M out
		// (8000 * 0.25 + 4000 * 1.0) / 1_000_000 = $0.0060 → 0.498 INR
		const cost = computeCostInr("gpt-5.4-mini", 8000, 4000);
		expect(cost).not.toBeNull();
		expect(cost).toBeCloseTo(0.498, 3);
	});

	it("respects AI_COST_USD_TO_INR env override", () => {
		process.env.AI_COST_USD_TO_INR = "90";
		// 1M tokens of gpt-5.4-mini @ $0.25 in only = $0.25 = 22.5 INR @ 90
		expect(computeCostInr("gpt-5.4-mini", 1_000_000, 0)).toBeCloseTo(22.5, 4);
	});

	it("returns null on negative tokens", () => {
		expect(computeCostInr("gpt-4o-mini", -1, 100)).toBeNull();
		expect(computeCostInr("gpt-4o-mini", 100, -1)).toBeNull();
	});

	it("matches a date-suffixed model variant via fuzzy lookup", () => {
		const direct = computeCostInr("gpt-4o", 1000, 1000);
		const dated = computeCostInr("gpt-4o-2024-08-06", 1000, 1000);
		expect(dated).toEqual(direct);
		expect(dated).not.toBeNull();
	});

	it("is case-insensitive on model name", () => {
		const lower = computeCostInr("gpt-4o-mini", 1000, 1000);
		const upper = computeCostInr("GPT-4o-MINI", 1000, 1000);
		expect(upper).toEqual(lower);
	});

	it("rounds to 4 decimal places", () => {
		const cost = computeCostInr("gpt-5.4-mini", 1, 1);
		// Tiny call: 1 input * 0.25/M + 1 output * 1.0/M = $1.25e-6 = ~0.0001 INR
		expect(cost).not.toBeNull();
		// Should not have more than 4 decimal places
		const str = String(cost);
		const dec = str.split(".")[1];
		if (dec) expect(dec.length).toBeLessThanOrEqual(4);
	});

	describe("DeepSeek V4 Pro cache split", () => {
		it("prices a pure cache-miss request at the regular tier", () => {
			// 1M cache-miss input + 0 output: 1M * $0.435 = $0.435 = 36.105 INR
			const cost = computeCostInr("deepseek-v4-pro", 1_000_000, 0, {
				cacheMissTokens: 1_000_000,
				cacheHitTokens: 0,
			});
			expect(cost).toBeCloseTo(36.105, 3);
		});

		it("prices a pure cache-hit request at the cheap tier", () => {
			// 1M cache-hit input + 0 output: 1M * $0.003625 = $0.003625 = 0.3009 INR
			const cost = computeCostInr("deepseek-v4-pro", 1_000_000, 0, {
				cacheHitTokens: 1_000_000,
				cacheMissTokens: 0,
			});
			expect(cost).toBeCloseTo(0.3009, 3);
		});

		it("splits cost across cache buckets correctly", () => {
			// 500k cache-hit + 500k cache-miss + 0 output:
			// 500_000 * 0.003625 + 500_000 * 0.435 = $1.8125 + $217500/1M = ...
			// (500_000 * 0.003625 + 500_000 * 0.435) / 1_000_000 = $0.219313
			// * 83 = 18.20 INR
			const cost = computeCostInr("deepseek-v4-pro", 1_000_000, 0, {
				cacheHitTokens: 500_000,
				cacheMissTokens: 500_000,
			});
			expect(cost).toBeCloseTo(18.2029, 3);
		});

		it("treats remainder as cache-miss when buckets are partial", () => {
			// 1M input total, only 200k bucketed as cache-hit, no cache-miss reported.
			// Remainder 800k → cache-miss tier.
			// 200_000 * 0.003625 + 800_000 * 0.435 = $725 + $348000 per 1M = ...
			// = (725 + 348000)/1_000_000 = $0.348725 * 83 = 28.94 INR
			const cost = computeCostInr("deepseek-v4-pro", 1_000_000, 0, {
				cacheHitTokens: 200_000,
				cacheMissTokens: null,
			});
			expect(cost).toBeCloseTo(28.9442, 3);
		});

		it("falls back to all-cache-miss when no breakdown given", () => {
			const withBreakdown = computeCostInr("deepseek-v4-pro", 1_000_000, 0, {
				cacheMissTokens: 1_000_000,
				cacheHitTokens: 0,
			});
			const withoutBreakdown = computeCostInr("deepseek-v4-pro", 1_000_000, 0);
			expect(withoutBreakdown).toEqual(withBreakdown);
		});

		it("prices output tokens at the model's output rate regardless of cache", () => {
			// 0 input + 1M output: 1M * $0.87 = $0.87 = 72.21 INR
			const cost = computeCostInr("deepseek-v4-pro", 0, 1_000_000);
			expect(cost).toBeCloseTo(72.21, 3);
		});
	});
});
