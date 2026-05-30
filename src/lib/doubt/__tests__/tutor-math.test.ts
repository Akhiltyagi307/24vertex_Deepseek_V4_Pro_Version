import { describe, expect, it } from "vitest";

import { normalizeTutorMarkdownMath } from "@/lib/doubt/tutor-math";

const SENTINEL = String.fromCharCode(0xe000);

describe("normalizeTutorMarkdownMath — delimiter conversion", () => {
	it("converts inline \\(...\\) to $...$", () => {
		expect(normalizeTutorMarkdownMath("speed is \\(v = u + at\\) here")).toBe(
			"speed is $v = u + at$ here",
		);
	});

	it("converts display \\[...\\] to a $$ block (own lines → renders as display)", () => {
		// Block form: $$ on its own lines so remark-math treats it as display math.
		expect(normalizeTutorMarkdownMath("result: \\[E = mc^2\\]")).toContain("$$\nE = mc^2\n$$");
	});

	it("handles both forms in one string", () => {
		const out = normalizeTutorMarkdownMath("First \\[a^2 + b^2 = c^2\\], then \\(x = 1\\).");
		expect(out).toContain("$$\na^2 + b^2 = c^2\n$$"); // display block
		expect(out).toContain("$x = 1$"); // inline
		expect(out).not.toContain("\\(");
		expect(out).not.toContain("\\[");
	});

	it("keeps inline $...$ inline and promotes $$...$$ to a display block", () => {
		expect(normalizeTutorMarkdownMath("inline $x^2$ stays")).toBe("inline $x^2$ stays");
		// Single-line $$...$$ is canonicalized to block form so remark-math renders
		// it as display (a single-line $$ otherwise parses as inline).
		expect(normalizeTutorMarkdownMath("block $$\\int_0^1 x\\,dx$$ stays")).toContain(
			"$$\n\\int_0^1 x\\,dx\n$$",
		);
	});
});

describe("normalizeTutorMarkdownMath — code is never rewritten", () => {
	it("does not convert delimiters inside a fenced code block", () => {
		const md = "```\nlatex like \\(x\\) and \\[y\\]\n```";
		const out = normalizeTutorMarkdownMath(md);
		expect(out).toBe(md); // verbatim — no $-conversion inside code
		expect(out).not.toContain("$");
	});

	it("does not convert delimiters inside inline code", () => {
		const out = normalizeTutorMarkdownMath("call `f(\\(x\\))` to run");
		expect(out).toContain("`f(\\(x\\))`");
		expect(out).not.toContain("$");
	});

	it("converts math OUTSIDE code while leaving code alone", () => {
		const out = normalizeTutorMarkdownMath("use \\(x\\) and `\\(y\\)`");
		expect(out).toContain("$x$"); // outside code → converted
		expect(out).toContain("`\\(y\\)`"); // inside code → untouched
	});
});

describe("normalizeTutorMarkdownMath — display blocks protected from Unicode pass", () => {
	it("does not rewrite Unicode inside a $$...$$ block", () => {
		// Unicode inside a display block is preserved verbatim — the Unicode→KaTeX
		// pass only touches prose, never display math internals. (The fence is
		// canonicalized to block form, but the content `x² + 1` is untouched.)
		const out = normalizeTutorMarkdownMath("$$x² + 1$$");
		expect(out).toContain("$$\nx² + 1\n$$");
	});
});

describe("normalizeTutorMarkdownMath — Unicode math in prose", () => {
	it("wraps Unicode super/subscripts into KaTeX in prose", () => {
		const out = normalizeTutorMarkdownMath("The area is 5 cm² in total.");
		expect(out).toContain("^{2}");
		expect(out).toContain("$");
	});

	it("normalizes operators / Greek in prose runs", () => {
		const out = normalizeTutorMarkdownMath("so x² ≤ 4 and the angle is π/2");
		expect(out).toContain("\\le");
		expect(out).toContain("\\pi");
	});
});

describe("normalizeTutorMarkdownMath — safety", () => {
	it("returns plain prose unchanged", () => {
		const text = "Let's break this into three simple steps and work through them.";
		expect(normalizeTutorMarkdownMath(text)).toBe(text);
	});

	it("handles empty input", () => {
		expect(normalizeTutorMarkdownMath("")).toBe("");
	});

	it("never leaks the internal placeholder sentinel", () => {
		const out = normalizeTutorMarkdownMath(
			"mix \\(a\\), code `\\(b\\)`, block \\[c²\\], and prose 5 cm² here",
		);
		expect(out).not.toContain(SENTINEL);
	});

	it("preserves mhchem content inside math (passes through as text)", () => {
		const out = normalizeTutorMarkdownMath("burning: $\\ce{2H2 + O2 -> 2H2O}$ releases heat");
		expect(out).toContain("$\\ce{2H2 + O2 -> 2H2O}$");
	});
});
