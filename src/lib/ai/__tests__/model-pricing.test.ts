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
});
