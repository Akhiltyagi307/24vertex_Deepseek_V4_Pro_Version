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

	it("extracts JSON array from prose wrappers", () => {
		const p = parseVisualPatchesFromValidatorText(
			'Applied patches below:\n[{"action":"null_visual","index":2}]\nDone.',
		);
		expect(p).toEqual([{ action: "null_visual", index: 2 }]);
	});

	it("coerces numeric index strings", () => {
		const p = parseVisualPatchesFromValidatorText(
			`[{"action":"rewrite_explanation","index":"3","explanation":"Updated."}]`,
		);
		expect(p).toEqual([{ action: "rewrite_explanation", index: 3, explanation: "Updated." }]);
	});

	it("parses object wrappers with patches array", () => {
		const p = parseVisualPatchesFromValidatorText(
			`{"patches":[{"action":"replace","question_index":"2","visual":{"caption":"c","altText":"a","spec":{"kind":"data_table","columns":["x"],"rows":[["1"]],"columnAlign":["left"]}}}]}`,
		);
		expect(p).toEqual([
			{
				action: "replace_visual",
				index: 2,
				value: {
					caption: "c",
					altText: "a",
					spec: {
						kind: "data_table",
						columns: ["x"],
						rows: [["1"]],
						columnAlign: ["left"],
					},
				},
			},
		]);
	});

	it("accepts null-visual aliases", () => {
		const p = parseVisualPatchesFromValidatorText(
			`[{"action":"remove_visual","idx":4}]`,
		);
		expect(p).toEqual([{ action: "null_visual", index: 4 }]);
	});
});
