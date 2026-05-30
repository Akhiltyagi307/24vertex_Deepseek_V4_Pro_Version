import { describe, expect, it } from "vitest";

import { normalizeKatexMath } from "../katex-math-normalize";

describe("normalizeKatexMath", () => {
	it("returns input unchanged when no Unicode math triggers are present", () => {
		expect(normalizeKatexMath("Plain prose with no math at all.")).toBe(
			"Plain prose with no math at all.",
		);
		expect(normalizeKatexMath("Use the formula y = mx + b.")).toBe(
			"Use the formula y = mx + b.",
		);
	});

	it("preserves existing $...$ regions untouched", () => {
		const input = "Find $(x - 2)^2 + (y + 5)^2 = 9$ and ignore prose.";
		expect(normalizeKatexMath(input)).toBe(input);
	});

	it("converts Unicode superscripts on identifiers", () => {
		expect(normalizeKatexMath("y² = -8x")).toBe("$y^{2} = -8x$");
		expect(normalizeKatexMath("x² + y² = 25")).toBe("$x^{2} + y^{2} = 25$");
		expect(normalizeKatexMath("a²³ value")).toBe("$a^{23}$ value");
	});

	it("converts Unicode subscripts on identifiers", () => {
		expect(normalizeKatexMath("Use r_s")).toBe("Use r_s");
		expect(normalizeKatexMath("Variable a₁₁")).toBe("Variable $a_{11}$");
	});

	it("wraps ±n in a math span containing \\pm", () => {
		const out1 = normalizeKatexMath("foci at (±4, 0)");
		expect(out1).toContain("\\pm");
		expect(out1).toMatch(/\$.*\\pm.*\$/);
		expect(out1).not.toContain("±");
	});

	it("wraps √(expr) in $\\sqrt{expr}$ without nested dollars", () => {
		const out1 = normalizeKatexMath("Length √(a²+b²)");
		expect(out1).toContain("\\sqrt{a^{2}+b^{2}}");
		// Critical: no nested dollars inside the sqrt argument.
		const insideSqrt = out1.match(/\\sqrt\{([^}]+)\}/);
		expect(insideSqrt?.[1]).not.toContain("$");

		const out2 = normalizeKatexMath("√25");
		expect(out2).toBe("$\\sqrt{25}$");

		const out3 = normalizeKatexMath("c = √(a²+b²)");
		expect(out3).toContain("\\sqrt");
		// Equation merged into single math span.
		expect(out3.startsWith("$")).toBe(true);
		expect(out3.endsWith("$")).toBe(true);
	});

	it("merges adjacent math regions across simple glue", () => {
		// y² and 25 should be merged into a single math span.
		const out = normalizeKatexMath("y² + 25 = z²");
		// y^2 + 25 = z^2 should all be one math run; the exact form may have minor merges.
		expect(out.startsWith("$")).toBe(true);
		expect(out.endsWith("$")).toBe(true);
		expect(out).toMatch(/y\^\{2\}/);
		expect(out).toMatch(/z\^\{2\}/);
	});

	it("converts operators between alphanumeric tokens", () => {
		expect(normalizeKatexMath("a ÷ b")).toMatch(/\$.*\\div.*\$/);
		expect(normalizeKatexMath("3 × 4 = 12")).toContain("\\times");
		expect(normalizeKatexMath("p ≤ q")).toMatch(/\$.*\\le.*\$/);
		// LHS and RHS pulled into the same math span.
		expect(normalizeKatexMath("a ÷ b")).toMatch(/\$a.*b\$/);
	});

	it("preserves bare Unicode math chars in pure prose", () => {
		// A degree sign in a temperature reading without other math triggers should pass through.
		expect(normalizeKatexMath("It was 25°C today.")).toBe("It was 25°C today.");
	});

	it("handles null and undefined input", () => {
		expect(normalizeKatexMath(null)).toBe("");
		expect(normalizeKatexMath(undefined)).toBe("");
	});

	it("converts a stat-style formula with Σ and superscript", () => {
		// rs = 1 - (6·ΣD²) / (n³ - n)
		const out = normalizeKatexMath("rs = 1 - (6·ΣD²) / (n³ - n)");
		// Should contain LaTeX equivalents for ², ³, and \cdot.
		expect(out).toMatch(/D\^\{2\}/);
		expect(out).toMatch(/n\^\{3\}/);
		// \cdot may appear; ΣD² is not a perfect pattern but D² should convert.
		expect(out).toContain("\\");
	});

	it("does not break existing $...$ when adjacent Unicode is present", () => {
		const input = "Plug into $x^2 + y^2 = 25$ to verify x² + y² works.";
		const out = normalizeKatexMath(input);
		// The existing math region stays exactly as-is.
		expect(out).toContain("$x^2 + y^2 = 25$");
		// The Unicode version gets wrapped.
		expect(out).toMatch(/\$x\^\{2\} \+ y\^\{2\}\$/);
	});

	it("idempotent on already-normalized input", () => {
		const once = normalizeKatexMath("y² + x² = r²");
		const twice = normalizeKatexMath(once);
		expect(twice).toBe(once);
	});
});

/**
 * Targeted regression tests for the "partial-wrap" residue we observed in
 * production on 2026-05-27 — strings the LLM emitted with only the prefix
 * wrapped in `$..$`, leaving the suffix as bare math glue (`– 4x – 8y`).
 * The widen-span post-pass should now absorb the suffix.
 */
describe("normalizeKatexMath — widen post-pass", () => {
	it("absorbs en-dash–glued tokens after a $..$ block", () => {
		// Exact form observed in production (Math R1 Q11).
		const input = "$x^{2} + y^{2}$ – 4x – 8y – 45 = 0";
		const out = normalizeKatexMath(input);
		// All math should now be inside ONE $..$ block, with en-dashes ASCII'd.
		expect(out.startsWith("$")).toBe(true);
		// Should NOT contain a closing $ in the middle (which would mean we
		// have multiple unmerged spans).
		const dollarCount = (out.match(/\$/g) ?? []).length;
		expect(dollarCount).toBe(2);
		// En-dashes converted to ASCII -
		expect(out).not.toMatch(/[–—]/);
		// Final expression contains all the operands
		expect(out).toContain("4x");
		expect(out).toContain("8y");
		expect(out).toContain("45");
	});

	it("absorbs plain math-token suffix joined by an ASCII operator", () => {
		const input = "$y^{2}$ = 4x";
		expect(normalizeKatexMath(input)).toBe("$y^{2} = 4x$");
	});

	it("absorbs plain math-token prefix joined by an ASCII operator", () => {
		const input = "Where c = $\\sqrt{a^{2}+b^{2}}$ is the hypotenuse.";
		const out = normalizeKatexMath(input);
		// `c = $\sqrt{...}$` should merge to `$c = \sqrt{...}$`
		expect(out).toContain("$c = \\sqrt{a^{2}+b^{2}}$");
	});

	it("heals mid-word function-name split: si$n^{2}$x → $\\sin^{2} x$", () => {
		const input = "si$n^{2}$x + co$s^{2}$x = 1";
		const out = normalizeKatexMath(input);
		expect(out).toContain("\\sin");
		expect(out).toContain("\\cos");
		// No mid-word fragments like `si` or `co` should remain bare.
		expect(out).not.toMatch(/\bsi\b/);
		expect(out).not.toMatch(/\bco\b/);
	});

	it("preserves words that aren't KaTeX function names", () => {
		// `te$st$` should NOT become `\test` (no such command).
		const input = "te$st$";
		expect(normalizeKatexMath(input)).toBe("te$st$");
	});

	it("heals mid-word split before a math tail: forc$e \\times ... → $force \\times ...$", () => {
		const input =
			"Therefore, work done = forc$e \\times displacement = 5$ $N \\times 0$ m = 0 J.";
		const out = normalizeKatexMath(input);
		expect(out).toContain("$force \\times displacement = 5 N \\times 0$");
		expect(out).not.toContain("forc$e");
	});

	it("converts standalone en-dash and em-dash to ASCII hyphen", () => {
		const input = "$a$ – $b$ — $c$";
		const out = normalizeKatexMath(input);
		expect(out).not.toMatch(/[–—]/);
		// All three terms should merge into one span via the iterative widening.
		expect(out).toBe("$a - b - c$");
	});

	it("does not mangle prose that has no math at all", () => {
		const input = "Just plain prose, nothing to do here.";
		expect(normalizeKatexMath(input)).toBe(input);
	});

	it("is idempotent — running twice yields the same result (real-world input)", () => {
		const input = "$x^{2} + y^{2}$ – 4x – 8y – 45 = 0";
		const once = normalizeKatexMath(input);
		const twice = normalizeKatexMath(once);
		expect(twice).toBe(once);
	});
});
