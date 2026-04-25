import { describe, expect, it } from "vitest";

import { jobStatusHint, sanitizeGradingErrorForUi } from "./grading-error-ui";

describe("sanitizeGradingErrorForUi", () => {
	it("returns empty for nullish", () => {
		expect(sanitizeGradingErrorForUi(null)).toBe("");
		expect(sanitizeGradingErrorForUi(undefined)).toBe("");
	});

	it("redacts bearer tokens and sk- keys", () => {
		const s = sanitizeGradingErrorForUi('Failed: Bearer eyJhbGc and key sk-12345678901234567890');
		expect(s).not.toContain("eyJ");
		expect(s).not.toContain("sk-12345678901234567890");
		expect(s).toContain("[redacted]");
	});

	it("truncates long strings", () => {
		const long = "x".repeat(300);
		expect(sanitizeGradingErrorForUi(long).length).toBeLessThanOrEqual(200);
		expect(sanitizeGradingErrorForUi(long).endsWith("…")).toBe(true);
	});
});

describe("jobStatusHint", () => {
	it("maps known statuses", () => {
		expect(jobStatusHint("pending")).toMatch(/queued/i);
		expect(jobStatusHint("running")).toMatch(/processing/i);
		expect(jobStatusHint("done")).toBeTruthy();
		expect(jobStatusHint("dead")).toMatch(/tries/i);
	});

	it("returns empty for unknown", () => {
		expect(jobStatusHint("")).toBe("");
	});
});
