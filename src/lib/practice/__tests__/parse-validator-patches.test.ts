import { describe, expect, it } from "vitest";

import { parseVisualPatchesFromValidatorText } from "../visuals/parse-validator-patches";

describe("parseVisualPatchesFromValidatorText", () => {
	it("parses raw JSON array", () => {
		const p = parseVisualPatchesFromValidatorText(`[{"action":"null_visual","index":1}]`);
		expect(p).toEqual([{ action: "null_visual", index: 1 }]);
	});

	it("strips markdown fence", () => {
		const p = parseVisualPatchesFromValidatorText(
			"Here you go:\n```json\n[{\"action\":\"rewrite_stem\",\"index\":0,\"question_text\":\"Hi\"}]\n```",
		);
		expect(p).toEqual([{ action: "rewrite_stem", index: 0, question_text: "Hi" }]);
	});

	it("returns empty on invalid JSON", () => {
		expect(parseVisualPatchesFromValidatorText("not json")).toEqual([]);
	});
});
