import { describe, expect, it } from "vitest";

import { classifyPracticeGenerationFailureForRetry } from "../practice-generation-retry-policy";

describe("classifyPracticeGenerationFailureForRetry", () => {
	it("does not retry generation_invalid failures", () => {
		const out = classifyPracticeGenerationFailureForRetry({
			code: "generation_invalid",
			message: "Question mix is off.",
		});
		expect(out.retryable).toBe(false);
		expect(out.reason).toBe("generation_invalid");
	});

	it("retries transient generation_failed failures", () => {
		const out = classifyPracticeGenerationFailureForRetry({
			code: "generation_failed",
			message: "The AI service is rate-limiting requests. Try again.",
		});
		expect(out.retryable).toBe(true);
		expect(out.reason).toBe("transient_generation_failed");
	});

	it("does not retry deterministic generation_failed failures", () => {
		const out = classifyPracticeGenerationFailureForRetry({
			code: "generation_failed",
			message: "Output blocked by moderation filters.",
		});
		expect(out.retryable).toBe(false);
		expect(out.reason).toBe("deterministic_generation_failed");
	});

	it("keeps unknown generation_failed as retryable for compatibility", () => {
		const out = classifyPracticeGenerationFailureForRetry({
			code: "generation_failed",
			message: "Could not generate the test.",
		});
		expect(out.retryable).toBe(true);
		expect(out.reason).toBe("unknown_generation_failed_default_retry");
	});
});
