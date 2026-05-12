import { describe, expect, it } from "vitest";

import { sanitizeForPostgresJsonb } from "../postgres-jsonb-sanitize";

describe("sanitizeForPostgresJsonb", () => {
	it("removes null unicode characters and escaped null markers from nested generated payloads", () => {
		const payload = {
			question_text: "Speed at infinity\u0000",
			answer_key: {
				explanation: "Generated text with \\u0000 embedded.",
				common_mistakes: ["bad\u0000text"],
			},
			metadata: {
				visual: {
					caption: "Earth cutaway",
					altText: "Radius label \\u0000 should not reach jsonb.",
				},
			},
		};

		expect(sanitizeForPostgresJsonb(payload)).toEqual({
			question_text: "Speed at infinity",
			answer_key: {
				explanation: "Generated text with  embedded.",
				common_mistakes: ["badtext"],
			},
			metadata: {
				visual: {
					caption: "Earth cutaway",
					altText: "Radius label  should not reach jsonb.",
				},
			},
		});
	});
});
