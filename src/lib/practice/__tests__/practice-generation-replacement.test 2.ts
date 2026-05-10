import { describe, expect, it } from "vitest";

import {
	buildCompactModerationReplacementPrompt,
	buildLegacyModerationReplacementPrompt,
} from "../practice-generation-replacement";

const ARGS = {
	baseUserPrompt: "BASE_PROMPT_TEXT",
	replacementCounts: {
		multiple_choice: 2,
		fill_in_blank: 1,
		short_answer: 0,
		long_answer: 0,
	},
	allowedTopicIds: ["11111111-1111-4111-8111-111111111111"],
	preferredTopicIds: ["11111111-1111-4111-8111-111111111111"],
	blockedQuestionTexts: ["Blocked stem"],
};

describe("replacement prompt builders", () => {
	it("legacy prompt keeps base user prompt context", () => {
		const text = buildLegacyModerationReplacementPrompt(ARGS);
		expect(text).toContain("BASE_PROMPT_TEXT");
		expect(text).toContain("MODERATION_REPLACEMENT_MODE");
		expect(text).toContain("REQUIRED_BUCKET_LENGTHS");
	});

	it("compact prompt omits base user prompt", () => {
		const text = buildCompactModerationReplacementPrompt(ARGS);
		expect(text).not.toContain("BASE_PROMPT_TEXT");
		expect(text).toContain("Generate replacement practice questions as strict JSON");
		expect(text).toContain("REQUIRED_BUCKET_LENGTHS");
		expect(text).toContain("BLOCKED_QUESTION_TEXTS");
	});
});
