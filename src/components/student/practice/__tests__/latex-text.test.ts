import { describe, expect, it } from "vitest";

import { parseLatexNodes } from "@/lib/practice/parse-latex-nodes";

describe("parseLatexNodes", () => {
	it("returns a single text node when no delimiters are present", () => {
		expect(parseLatexNodes("plain prose only")).toEqual([
			{ type: "text", value: "plain prose only" },
		]);
	});

	it("returns empty-input safely", () => {
		expect(parseLatexNodes("")).toEqual([{ type: "text", value: "" }]);
	});

	it("recognises inline $...$ math", () => {
		expect(parseLatexNodes("Find $x^2 + y^2$.")).toEqual([
			{ type: "text", value: "Find " },
			{ type: "math", value: "x^2 + y^2", display: false },
			{ type: "text", value: "." },
		]);
	});

	it("recognises display $$...$$ math as block", () => {
		const out = parseLatexNodes("Setup: $$\\int_0^1 x\\,dx$$");
		expect(out).toEqual([
			{ type: "text", value: "Setup: " },
			{ type: "math", value: "\\int_0^1 x\\,dx", display: true },
		]);
	});

	it("recognises both display $$...$$ and inline $...$ in the same string", () => {
		const out = parseLatexNodes("Inline $a^2$ then block $$b^2 = c^2$$.");
		expect(out).toEqual([
			{ type: "text", value: "Inline " },
			{ type: "math", value: "a^2", display: false },
			{ type: "text", value: " then block " },
			{ type: "math", value: "b^2 = c^2", display: true },
			{ type: "text", value: "." },
		]);
	});

	it("recognises LaTeX-conventional \\[...\\] for display", () => {
		const out = parseLatexNodes("Result: \\[E = mc^2\\] (Einstein).");
		expect(out).toEqual([
			{ type: "text", value: "Result: " },
			{ type: "math", value: "E = mc^2", display: true },
			{ type: "text", value: " (Einstein)." },
		]);
	});

	it("recognises LaTeX-conventional \\(...\\) for inline", () => {
		const out = parseLatexNodes("Substitute \\(x = 2\\) into the formula.");
		expect(out).toEqual([
			{ type: "text", value: "Substitute " },
			{ type: "math", value: "x = 2", display: false },
			{ type: "text", value: " into the formula." },
		]);
	});

	it("does NOT regress on the prior `$$..$$` bug (split-on-single-dollar would have broken this)", () => {
		// Before the fix, splitting on /(\$[^$]*\$)/g parsed `$$x$$` as ["$$","x","$$"]
		// where the inner "x" was a text node — display math rendered as plain text.
		const out = parseLatexNodes("$$x^2$$");
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({ type: "math", value: "x^2", display: true });
	});

	it("treats `$$ $$` (empty body) gracefully", () => {
		const out = parseLatexNodes("Pre $$ $$ post.");
		// The regex matches the `$$ $$` as a display math token with empty body.
		expect(out.some((n) => n.type === "math" && n.value === "" && n.display)).toBe(true);
	});

	it("does not mistake a lone unclosed `$` for math", () => {
		// `$5` is a price, not math — the regex requires a closing `$` on the
		// same line, so this should pass through as text.
		const out = parseLatexNodes("The book costs $5 today.");
		// The parser does NOT find a closing `$`, so everything passes through.
		expect(out).toEqual([{ type: "text", value: "The book costs $5 today." }]);
	});
});
