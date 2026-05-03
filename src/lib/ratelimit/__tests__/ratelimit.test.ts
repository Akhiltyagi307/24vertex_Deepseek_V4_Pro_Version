import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	__resetCircuitForTest,
	isCircuitOpen,
	recordFailure,
	recordSuccess,
} from "../circuit-breaker";
import { __resetDenialsForTest, isCachedDenied, recordDeny } from "../lru";

describe("ratelimit/lru", () => {
	beforeEach(() => {
		__resetDenialsForTest();
	});

	it("returns false for unknown keys", () => {
		expect(isCachedDenied("never-seen")).toBe(false);
	});

	it("returns true after recordDeny", () => {
		recordDeny("user:1");
		expect(isCachedDenied("user:1")).toBe(true);
	});

	it("expires entries after TTL", () => {
		vi.useFakeTimers();
		try {
			recordDeny("user:1");
			expect(isCachedDenied("user:1")).toBe(true);
			vi.advanceTimersByTime(2_000);
			expect(isCachedDenied("user:1")).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("re-recording resets the TTL", () => {
		vi.useFakeTimers();
		try {
			recordDeny("user:1");
			vi.advanceTimersByTime(1_000);
			recordDeny("user:1");
			vi.advanceTimersByTime(1_000);
			// 2s elapsed total but second recordDeny reset the clock at 1s
			expect(isCachedDenied("user:1")).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("ratelimit/circuit-breaker", () => {
	beforeEach(() => {
		__resetCircuitForTest();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts closed", () => {
		expect(isCircuitOpen()).toBe(false);
	});

	it("stays closed under all-success workload", () => {
		for (let i = 0; i < 30; i++) recordSuccess();
		expect(isCircuitOpen()).toBe(false);
	});

	it("trips open when failure rate exceeds 5%", () => {
		// 9 successes + 1 failure = 10% failure rate; above the 5% threshold and
		// past the 10-sample minimum, so the breaker trips.
		for (let i = 0; i < 9; i++) recordSuccess();
		recordFailure(new Error("simulated"));
		expect(isCircuitOpen()).toBe(true);
	});

	it("does not trip below the minimum sample size", () => {
		// Failures only, but fewer than 10 samples — breaker stays closed so a
		// single bad call does not blackhole the gate.
		for (let i = 0; i < 5; i++) recordFailure(new Error("simulated"));
		expect(isCircuitOpen()).toBe(false);
	});

	it("re-closes after the cooldown elapses", () => {
		vi.useFakeTimers();
		for (let i = 0; i < 9; i++) recordSuccess();
		recordFailure(new Error("simulated"));
		expect(isCircuitOpen()).toBe(true);
		vi.advanceTimersByTime(6_000); // > COOLDOWN_MS
		expect(isCircuitOpen()).toBe(false);
	});
});
