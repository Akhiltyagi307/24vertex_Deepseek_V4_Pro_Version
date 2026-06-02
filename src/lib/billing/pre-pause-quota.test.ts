import { describe, expect, it } from "vitest";

import { parsePrePauseQuota } from "@/lib/billing/pre-pause-quota";

describe("parsePrePauseQuota", () => {
	it("parses a valid snapshot", () => {
		expect(parsePrePauseQuota({ testsQuota: 30, tokensQuota: 1000 })).toEqual({
			testsQuota: 30,
			tokensQuota: 1000,
		});
	});

	it("returns null when absent", () => {
		expect(parsePrePauseQuota(null)).toBeNull();
		expect(parsePrePauseQuota(undefined)).toBeNull();
	});

	it("rejects a renamed/drifted shape rather than restoring garbage", () => {
		expect(parsePrePauseQuota({ tests_quota: 30, tokens_quota: 1000 })).toBeNull();
		expect(parsePrePauseQuota({ testsQuota: "30", tokensQuota: 1000 })).toBeNull();
		expect(parsePrePauseQuota({ testsQuota: 30 })).toBeNull();
	});

	it("rejects negative or non-integer quotas", () => {
		expect(parsePrePauseQuota({ testsQuota: -1, tokensQuota: 0 })).toBeNull();
		expect(parsePrePauseQuota({ testsQuota: 1.5, tokensQuota: 0 })).toBeNull();
	});
});
