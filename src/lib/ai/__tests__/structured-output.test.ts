import { describe, expect, it } from "vitest";
import { z } from "zod";

import { __testOnly } from "../structured-output";

const { extractJsonObject, parseAndValidate, buildJsonModePreamble, mergeProviderOptions } =
	__testOnly;

const sampleSchema = z.object({
	question: z.string(),
	answer: z.string(),
	difficulty: z.enum(["easy", "medium", "hard"]),
});

describe("structured-output / extractJsonObject", () => {
	it("returns trimmed object literal as-is", () => {
		expect(extractJsonObject('  {"a":1}  ')).toBe('{"a":1}');
	});

	it("strips ```json fences", () => {
		const fenced = '```json\n{"a":1}\n```';
		expect(extractJsonObject(fenced)).toBe('{"a":1}');
	});

	it("strips bare ``` fences", () => {
		const fenced = '```\n{"a":1}\n```';
		expect(extractJsonObject(fenced)).toBe('{"a":1}');
	});

	it("locates first {...} block when wrapped in prose", () => {
		const noisy = 'Sure! Here is the JSON: {"a":1,"b":2}. Hope that helps.';
		expect(extractJsonObject(noisy)).toBe('{"a":1,"b":2}');
	});

	it("returns null for empty input", () => {
		expect(extractJsonObject("")).toBeNull();
		expect(extractJsonObject("   ")).toBeNull();
	});

	it("returns null when no braces present", () => {
		expect(extractJsonObject("not json at all")).toBeNull();
	});
});

describe("structured-output / parseAndValidate", () => {
	it("returns ok on schema-valid JSON", () => {
		const out = parseAndValidate(
			'{"question":"2+2?","answer":"4","difficulty":"easy"}',
			sampleSchema,
		);
		expect(out.ok).toBe(true);
		if (out.ok) expect(out.data.answer).toBe("4");
	});

	it("returns ok on JSON inside markdown fence", () => {
		const out = parseAndValidate(
			'```json\n{"question":"2+2?","answer":"4","difficulty":"easy"}\n```',
			sampleSchema,
		);
		expect(out.ok).toBe(true);
	});

	it("returns invalid_json on syntactically broken JSON", () => {
		const out = parseAndValidate('{"question": "x", broken}', sampleSchema);
		expect(out.ok).toBe(false);
		if (!out.ok) expect(out.reason).toBe("invalid_json");
	});

	it("returns schema_mismatch on wrong shape", () => {
		const out = parseAndValidate(
			'{"question":"x","answer":"y","difficulty":"impossible"}',
			sampleSchema,
		);
		expect(out.ok).toBe(false);
		if (!out.ok) {
			expect(out.reason).toBe("schema_mismatch");
			expect(out.detail).toContain("difficulty");
		}
	});

	it("returns empty on no parseable JSON", () => {
		const out = parseAndValidate("not json", sampleSchema);
		expect(out.ok).toBe(false);
		if (!out.ok) expect(out.reason).toBe("empty");
	});
});

describe("structured-output / buildJsonModePreamble", () => {
	it('includes the literal word "json" for DeepSeek\'s mode requirement', () => {
		const preamble = buildJsonModePreamble(sampleSchema);
		expect(preamble.toLowerCase()).toContain("json");
	});

	it("embeds a renderable JSON Schema derived from the Zod schema", () => {
		const preamble = buildJsonModePreamble(sampleSchema);
		// The schema field names should appear so the model knows what to emit.
		expect(preamble).toContain("question");
		expect(preamble).toContain("difficulty");
	});

	it("instructs no prose/markdown", () => {
		const preamble = buildJsonModePreamble(sampleSchema);
		expect(preamble.toLowerCase()).toMatch(/no.*markdown|markdown.*no/);
	});
});

describe("structured-output / mergeProviderOptions", () => {
	it("router options override caller options for the same provider key", () => {
		const router = { deepseek: { thinking: { type: "enabled" }, reasoningEffort: "high" } };
		const caller = { deepseek: { thinking: { type: "disabled" }, foo: "bar" } };
		const merged = mergeProviderOptions(router, caller);
		// caller `foo` retained, router `thinking` wins.
		expect(merged.deepseek.thinking).toEqual({ type: "enabled" });
		expect(merged.deepseek.reasoningEffort).toBe("high");
		expect(merged.deepseek.foo).toBe("bar");
	});

	it("returns router options unchanged when caller passes undefined", () => {
		const router = { deepseek: { thinking: { type: "enabled" } } };
		expect(mergeProviderOptions(router, undefined)).toEqual(router);
	});

	it("preserves unrelated provider keys from caller", () => {
		const router = { deepseek: { thinking: { type: "enabled" } } };
		const caller = { openai: { strictJsonSchema: true } };
		const merged = mergeProviderOptions(router, caller);
		expect(merged.openai).toEqual({ strictJsonSchema: true });
		expect(merged.deepseek).toEqual({ thinking: { type: "enabled" } });
	});
});
