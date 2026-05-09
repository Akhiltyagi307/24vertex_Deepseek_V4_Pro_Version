import { describe, expect, it } from "vitest";

import {
	applyLowContextFallbackPromptGuards,
	shouldUseLowContextFallback,
} from "../practice-low-context-fallback";

describe("shouldUseLowContextFallback", () => {
	it("returns false when feature flag is disabled", () => {
		expect(
			shouldUseLowContextFallback({
				enabled: false,
				contextQuality: "low_context",
			}),
		).toBe(false);
	});

	it("returns true for low/no context qualities when enabled", () => {
		expect(
			shouldUseLowContextFallback({
				enabled: true,
				contextQuality: "low_context",
			}),
		).toBe(true);
		expect(
			shouldUseLowContextFallback({
				enabled: true,
				contextQuality: "no_context",
			}),
		).toBe(true);
	});
});

describe("applyLowContextFallbackPromptGuards", () => {
	it("appends conservative guard rails to prompts", () => {
		const out = applyLowContextFallbackPromptGuards({
			systemPrompt: "SYSTEM_BASE",
			userPrompt: "USER_BASE",
		});
		expect(out.systemPrompt).toContain("SYSTEM_BASE");
		expect(out.systemPrompt).toContain("LOW_CONTEXT_FALLBACK_GUARD");
		expect(out.userPrompt).toContain("USER_BASE");
		expect(out.userPrompt).toContain("LOW_CONTEXT_MODE");
	});
});
