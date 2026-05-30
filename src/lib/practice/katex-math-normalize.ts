/**
 * Conservative Unicode-math → KaTeX normalizer.
 *
 * The question-generation prompt instructs the LLM to wrap math in
 * `$...$`, but observation shows it slips into Unicode super/subscripts
 * (`x²`, `√34`, `±4`, …) for many questions — especially in
 * `answer_key.explanation`. The `LatexText` renderer only KaTeX-typesets
 * content inside `$...$`; anything else renders as body-font characters,
 * which looks inconsistent next to properly-wrapped expressions on the
 * same page.
 *
 * This module runs deterministically after generation (inside
 * `applyDeterministicPracticeAutofix`) and converts the most common
 * Unicode-math patterns into LaTeX, wrapping each converted region in
 * `$...$`. It is intentionally conservative: it only touches tight math
 * runs (e.g. `y²`, `√34`, `±4`), never whole sentences, and it skips
 * any text that already lives inside `$...$`.
 */

const SUPERSCRIPT_TO_TEX: Record<string, string> = {
	"⁰": "0", // ⁰
	"¹": "1", // ¹
	"²": "2", // ²
	"³": "3", // ³
	"⁴": "4", // ⁴
	"⁵": "5", // ⁵
	"⁶": "6", // ⁶
	"⁷": "7", // ⁷
	"⁸": "8", // ⁸
	"⁹": "9", // ⁹
	"⁺": "+", // ⁺
	"⁻": "-", // ⁻
	"⁼": "=", // ⁼
	"⁽": "(", // ⁽
	"⁾": ")", // ⁾
	"ⁿ": "n", // ⁿ
};

const SUBSCRIPT_TO_TEX: Record<string, string> = {
	"₀": "0", // ₀
	"₁": "1",
	"₂": "2",
	"₃": "3",
	"₄": "4",
	"₅": "5",
	"₆": "6",
	"₇": "7",
	"₈": "8",
	"₉": "9",
	"₊": "+", // ₊
	"₋": "-", // ₋
	"₌": "=", // ₌
	"₍": "(", // ₍
	"₎": ")", // ₎
};

const SIMPLE_OP_TO_TEX: Record<string, string> = {
	"÷": "\\div ", // ÷
	"×": "\\times ", // ×
	"·": "\\cdot ", // ·
	"≤": "\\le ", // ≤
	"≥": "\\ge ", // ≥
	"≠": "\\ne ", // ≠
	"≈": "\\approx ", // ≈
	"∞": "\\infty ", // ∞
	"−": "-", // − (mathematical minus → ASCII hyphen-minus inside KaTeX)
};

const GREEK_TO_TEX: Record<string, string> = {
	"Σ": "\\sum ", // Σ
	"Π": "\\prod ", // Π
	"Δ": "\\Delta ", // Δ
	"Ω": "\\Omega ", // Ω
	"Φ": "\\Phi ", // Φ
	"Ψ": "\\Psi ", // Ψ
	"α": "\\alpha ", // α
	"β": "\\beta ", // β
	"γ": "\\gamma ", // γ
	"δ": "\\delta ", // δ
	"ε": "\\epsilon ", // ε
	"ζ": "\\zeta ", // ζ
	"η": "\\eta ", // η
	"θ": "\\theta ", // θ
	"λ": "\\lambda ", // λ
	"μ": "\\mu ", // μ
	"ν": "\\nu ", // ν
	"ξ": "\\xi ", // ξ
	"π": "\\pi ", // π
	"ρ": "\\rho ", // ρ
	"σ": "\\sigma ", // σ
	"τ": "\\tau ", // τ
	"φ": "\\phi ", // φ
	"χ": "\\chi ", // χ
	"ψ": "\\psi ", // ψ
	"ω": "\\omega ", // ω
};

const SUPERSCRIPT_CHARS = Object.keys(SUPERSCRIPT_TO_TEX).join("");
const SUBSCRIPT_CHARS = Object.keys(SUBSCRIPT_TO_TEX).join("");
const SIMPLE_OP_CHARS = Object.keys(SIMPLE_OP_TO_TEX).join("");
const GREEK_CHARS = Object.keys(GREEK_TO_TEX).join("");

// Any character whose presence in non-`$...$` prose signals an unconverted
// math expression that the renderer cannot KaTeX-typeset.
const HAS_UNICODE_MATH = new RegExp(
	`[±√∫${SUPERSCRIPT_CHARS}${SUBSCRIPT_CHARS}${SIMPLE_OP_CHARS}${GREEK_CHARS}]`,
);

// Pass A walks character-by-character so the runs are produced by the for-loop;
// no separate global regex is needed.

/**
 * Two-pass transformation:
 *
 *   Pass A — convert ALL Unicode-math characters in the segment to their
 *            LaTeX-text equivalents (no `$...$` yet). After this pass the
 *            segment contains `^{2}`, `\sqrt{...}`, `\pm`, `\cdot`, etc.
 *            as plain text adjacent to identifiers / numbers / operators.
 *
 *   Pass B — find each LaTeX marker (`^{...}`, `_{...}`, `\<command>`) and
 *            wrap it (plus its immediate base/operand) in `$...$`. A merge
 *            post-pass collapses adjacent math runs joined by simple
 *            equation glue (`=`, `+`, `-`, `*`, `/`, `<`, `>`, `,`).
 *
 * Splitting the work this way avoids the bug where wrapping `a²` first
 * and then handling `√(...)` produced nested `$\sqrt{$a^{2}$...$}$` —
 * KaTeX cannot render nested dollars, so we must convert text first and
 * wrap once at the end.
 */
function transformPlainSegment(seg: string): string {
	if (!HAS_UNICODE_MATH.test(seg)) return seg;

	// === Pass A: Unicode → LaTeX text (no wrapping) ============================
	let s = "";
	for (let i = 0; i < seg.length; i++) {
		const ch = seg[i]!;
		if (SUPERSCRIPT_TO_TEX[ch] != null) {
			let run = SUPERSCRIPT_TO_TEX[ch]!;
			while (i + 1 < seg.length && SUPERSCRIPT_TO_TEX[seg[i + 1]!] != null) {
				i += 1;
				run += SUPERSCRIPT_TO_TEX[seg[i]!]!;
			}
			s += `^{${run}}`;
		} else if (SUBSCRIPT_TO_TEX[ch] != null) {
			let run = SUBSCRIPT_TO_TEX[ch]!;
			while (i + 1 < seg.length && SUBSCRIPT_TO_TEX[seg[i + 1]!] != null) {
				i += 1;
				run += SUBSCRIPT_TO_TEX[seg[i]!]!;
			}
			s += `_{${run}}`;
		} else if (ch === "√") {
			s += "\\sqrt";
		} else if (ch === "∫") {
			s += "\\int ";
		} else if (ch === "±") {
			s += "\\pm ";
		} else if (SIMPLE_OP_TO_TEX[ch] != null) {
			s += SIMPLE_OP_TO_TEX[ch]!;
		} else if (GREEK_TO_TEX[ch] != null) {
			s += GREEK_TO_TEX[ch]!;
		} else {
			s += ch;
		}
	}

	// Tighten `\sqrt(N)` / `\sqrt N` / `\sqrtN` → `\sqrt{N}`.
	// Pass A emits `\sqrt` without a trailing space, so the token can be
	// flush with the command name (`\sqrt25`).
	s = s.replace(/\\sqrt\s*\(([^()]+)\)/g, (_m, inner) => `\\sqrt{${inner.trim()}}`);
	s = s.replace(
		/\\sqrt\s*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)?(?:\^\{[^}]+\})?)/g,
		"\\sqrt{$1}",
	);
	// Strip the trailing space the operator-map adds when followed by `{`.
	s = s.replace(/\\sqrt\s+\{/g, "\\sqrt{");

	// === Pass B: wrap LaTeX runs in $...$ =====================================
	// Markers that indicate "this neighbourhood is math":
	//  - `^{...}` superscript fragment
	//  - `_{...}` subscript fragment
	//  - `\<command>` (LaTeX command name only; operand is grabbed via brace
	//    matching in the right-walk below to handle nested braces correctly).
	const MARKER_REGEX = /(\^\{[^}]+\}|_\{[^}]+\}|\\[A-Za-z]+)/g;
	// Commands that consume an operand to the right (postfix/prefix operators).
	const COMMANDS_WITH_RIGHT_OPERAND = new Set([
		"sqrt",
		"pm",
		"mp",
		"sum",
		"int",
		"prod",
	]);
	// Commands that sit between two operands (we also pull in the LHS).
	const INFIX_COMMANDS = new Set([
		"cdot",
		"div",
		"times",
		"le",
		"ge",
		"ne",
		"approx",
	]);

	// Walk through markers and expand each into a wrapped math span by also
	// pulling in adjacent base characters / operands.
	const result: string[] = [];
	let cursor = 0;
	let m: RegExpExecArray | null;
	MARKER_REGEX.lastIndex = 0;
	while ((m = MARKER_REGEX.exec(s)) != null) {
		const markerStart = m.index;
		const markerEnd = markerStart + m[0].length;
		// Skip markers that fall inside a span already consumed by an earlier
		// wrap (e.g., `^{2}` nested inside `\sqrt{a^{2}+b^{2}}` — the outer
		// `\sqrt{...}` is the right boundary, the inner markers must not be
		// re-wrapped).
		if (markerStart < cursor) continue;

		// Walk LEFT to grab the base for ^{...} / _{...} (a single character or
		// parenthesised group) and for infix LaTeX commands (their LHS operand).
		let spanStart = markerStart;
		const cmdMatch = m[0].match(/^\\([A-Za-z]+)$/);
		const cmd = cmdMatch ? cmdMatch[1]! : null;
		const isSuperOrSub = m[0].startsWith("^") || m[0].startsWith("_");
		const isInfix = cmd != null && INFIX_COMMANDS.has(cmd);
		if (isSuperOrSub || isInfix) {
			// Skip any spaces immediately before the marker.
			let walk = spanStart;
			while (walk > 0 && s[walk - 1] === " ") walk -= 1;
			// Pull in immediately-preceding base char (alphanumeric or `)`).
			if (walk > 0 && /[A-Za-z0-9)]/.test(s[walk - 1]!)) {
				walk -= 1;
				if (s[walk] === ")") {
					let depth = 1;
					while (walk > 0 && depth > 0) {
						walk -= 1;
						if (s[walk] === "(") depth -= 1;
						else if (s[walk] === ")") depth += 1;
					}
				}
				spanStart = walk;
			}
		}

		// Walk RIGHT to grab the operand for sqrt / pm / cdot / div / etc.
		let spanEnd = markerEnd;
		if (cmd && (COMMANDS_WITH_RIGHT_OPERAND.has(cmd) || INFIX_COMMANDS.has(cmd))) {
			while (spanEnd < s.length && s[spanEnd] === " ") spanEnd += 1;
			if (s[spanEnd] === "{") {
				let depth = 1;
				spanEnd += 1;
				while (spanEnd < s.length && depth > 0) {
					if (s[spanEnd] === "{") depth += 1;
					else if (s[spanEnd] === "}") depth -= 1;
					spanEnd += 1;
				}
			} else if (s[spanEnd] === "(") {
				let depth = 1;
				spanEnd += 1;
				while (spanEnd < s.length && depth > 0) {
					if (s[spanEnd] === "(") depth += 1;
					else if (s[spanEnd] === ")") depth -= 1;
					spanEnd += 1;
				}
			} else {
				const tokenMatch = s
					.slice(spanEnd)
					.match(/^-?\d+(?:\.\d+)?[A-Za-z]?|^[A-Za-z]\w*/);
				if (tokenMatch) spanEnd += tokenMatch[0].length;
			}
		}

		result.push(s.slice(cursor, spanStart));
		result.push("$");
		result.push(s.slice(spanStart, spanEnd));
		result.push("$");
		cursor = spanEnd;
		// Advance the regex so subsequent exec calls skip everything we just
		// wrapped. Without this, the engine continues from `markerEnd` (just
		// past `\sqrt`) and re-matches the inner `^{2}` superscripts, which
		// would corrupt the output with nested dollars.
		MARKER_REGEX.lastIndex = spanEnd;
	}
	result.push(s.slice(cursor));
	s = result.join("");

	// === Pass C: merge adjacent $...$ regions joined by simple equation glue ===
	let prev: string;
	do {
		prev = s;
		// `$<a>$ <op> $<b>$` → `$<a> <op> <b>$`
		s = s.replace(
			/\$([^$]+)\$(\s*[=+\-*/<>,]\s*)\$([^$]+)\$/g,
			(_m, a, glue, b) => `$${a}${glue}${b}$`,
		);
		// `$<a>$ <op> <plain>` where plain looks like a math token → `$<a> <op> <plain>$`
		s = s.replace(
			/\$([^$]+)\$(\s*[=+\-*/<>,]\s*)(-?\d+(?:\.\d+)?[A-Za-z]?|[A-Za-z](?:\^\{[^}]+\}|_\{[^}]+\})?)/g,
			(_m, a, glue, b) => `$${a}${glue}${b}$`,
		);
		// `<plain> <op> $<b>$` where plain is a single math token → `$<plain> <op> <b>$`
		// Boundary check: the token must be word-bounded on its left (start of
		// string or whitespace). Captures equations like `c = $\sqrt{...}$` so
		// the whole equation lands in one math span.
		s = s.replace(
			/(^|[\s(])(-?\d+(?:\.\d+)?[A-Za-z]?|[A-Za-z](?:\^\{[^}]+\}|_\{[^}]+\})?)(\s*[=+\-*/<>,]\s*)\$([^$]+)\$/g,
			(_m, lead, a, glue, b) => `${lead}$${a}${glue}${b}$`,
		);
	} while (s !== prev);

	return s;
}

// Standard KaTeX function-name commands. When we see a mid-word split like
// `si$n^{2}$x`, we try to reconstruct `$\sin^{2} x$` by checking if the
// alpha prefix + the first char of the inner math forms one of these names.
const KATEX_FUNCTION_NAMES = [
	"sin",
	"cos",
	"tan",
	"sec",
	"csc",
	"cot",
	"sinh",
	"cosh",
	"tanh",
	"log",
	"ln",
	"lg",
	"exp",
	"min",
	"max",
	"lim",
	"arcsin",
	"arccos",
	"arctan",
	"sqrt",
	"det",
	"gcd",
	"deg",
	"dim",
	"hom",
	"ker",
];
const KATEX_FUNCTION_NAMES_BY_LEN: Record<number, Set<string>> = (() => {
	const out: Record<number, Set<string>> = {};
	for (const name of KATEX_FUNCTION_NAMES) {
		(out[name.length] ??= new Set<string>()).add(name);
	}
	return out;
})();

/**
 * Global post-pass on a string that already had `transformPlainSegment`
 * applied per-segment. Two jobs:
 *
 *   1. Replace Unicode en-dash (U+2013) and em-dash (U+2014) with ASCII `-`
 *      throughout — segment-level Pass A skips these because alone they
 *      don't trigger HAS_UNICODE_MATH. The dashes commonly appear as
 *      negative-sign glue inside math expressions (`$x^{2}$ – 4x – 8y`).
 *      Converting unlocks Pass B/C merging.
 *
 *   2. Widen `$..$` spans to absorb adjacent math-token glue. The original
 *      per-segment Pass C merges `$<a>$ <op> $<b>$` only when both ends are
 *      already wrapped — but it doesn't see across the segment boundary
 *      created by an LLM's prefix-only wrap like `$x^{2} + y^{2}$ - 4x - 45 = 0`.
 *      We iterate `$<a>$ <op> <plain-math-token>` → `$<a> <op> <plain>$` and
 *      `<plain> <op> $<b>$` → `$<plain> <op> <b>$` globally until stable.
 *
 *   3. Heal mid-word splits where the LLM wrapped only the exponent inside a
 *      function name (`si$n^{2}$x` → `$\sin^{2} x$`). Look for the pattern
 *      `<alpha>$<inner>$<alpha-or-space-or-eol>` where the alpha prefix +
 *      first char of the inner forms a known KaTeX function name. Replace
 *      with `$\<func>...$`.
 */
function widenMathSpans(s: string): string {
	// (1) Dash normalization. Done first so the dashes become valid glue.
	let out = s.replace(/[–—]/g, "-");

	// (3a) Mid-word split where the opening `$` landed one letter too late, e.g.
	// `forc$e \times displacement = 5$` → `$force \times displacement = 5$`.
	out = out.replace(
		/([A-Za-z]{2,})\$([A-Za-z])(\s*(?:\\[a-zA-Z]+|[=+\-*/<>,]|-?\d)[\s\S]*?\$)/g,
		(_full, prefix: string, letter: string, mathTail: string) => `$${prefix}${letter}${mathTail}`,
	);

	// (3) Mid-word function-name split. Process before the iterate-until-stable
	// merge so the merge sees fewer mid-word artifacts.
	out = out.replace(
		/([A-Za-z]+)\$([^$]*)\$([A-Za-z]?)/g,
		(full, prefix: string, inner: string, suffix: string) => {
			// Try lengths from longest to shortest so `arcsin` wins over `sin`.
			for (const targetLen of [6, 4, 3, 2]) {
				if (prefix.length >= targetLen) continue; // prefix alone is the function — no inner char needed
				const innerFirst = inner[0];
				if (!innerFirst || !/[A-Za-z]/.test(innerFirst)) continue;
				const reconstructed = (prefix + innerFirst).toLowerCase();
				if (
					KATEX_FUNCTION_NAMES_BY_LEN[reconstructed.length]?.has(reconstructed)
				) {
					// `si$n^{2}$x` → prefix=`si`, inner=`n^{2}`, suffix=`x`
					//             → `$\sin^{2} x$`
					return `$\\${reconstructed}${inner.slice(1)}${suffix ? " " + suffix : ""}$`;
				}
			}
			// No function-name reconstruction; leave untouched.
			return full;
		},
	);

	// (2) Iterative widening — runs until no more merges happen.
	const glue = String.raw`\s*[=+\-*/<>,]\s*`;
	const mathToken = String.raw`-?\d+(?:\.\d+)?[A-Za-z]?|[A-Za-z](?:\^\{[^}]+\}|_\{[^}]+\})?`;
	const mergeBothWrapped = new RegExp(
		`\\$([^$]+)\\$(${glue})\\$([^$]+)\\$`,
		"g",
	);
	// Adjacent `$a$ $b$` with only whitespace — common when the LLM splits units
	// (`$5$ $N \times 0$`) or equation fragments across spans.
	const mergeSpaceSeparated = /\$([^$]+)\$\s+\$([^$]+)\$/g;
	const mergeRightPlain = new RegExp(
		`\\$([^$]+)\\$(${glue})(${mathToken})(?![A-Za-z_])`,
		"g",
	);
	const mergeLeftPlain = new RegExp(
		`(^|[\\s(])(${mathToken})(${glue})\\$([^$]+)\\$`,
		"g",
	);

	let prev: string;
	let iterations = 0;
	do {
		prev = out;
		out = out.replace(mergeBothWrapped, (_m, a, g, b) => `$${a}${g}${b}$`);
		out = out.replace(mergeSpaceSeparated, (_m, a, b) => `$${a} ${b}$`);
		out = out.replace(mergeRightPlain, (_m, a, g, b) => `$${a}${g}${b}$`);
		out = out.replace(mergeLeftPlain, (_m, lead, a, g, b) => `${lead}$${a}${g}${b}$`);
		iterations += 1;
		// Safety: bail after 20 iterations even if the loop hasn't stabilized.
		// In practice, real-world inputs settle within 3-4 iterations.
	} while (out !== prev && iterations < 20);

	return out;
}

/**
 * Normalize Unicode-math idioms in `input` to KaTeX-wrapped expressions.
 *
 * - Preserves existing `$...$` regions verbatim.
 * - Converts `²³⁴...` → `^{n}`, `₀₁₂...` → `_{n}`, `√n` → `\sqrt{n}`,
 *   `±n` → `\pm n`, and a curated set of operators / Greek letters when
 *   they appear in math runs (between alphanumeric tokens).
 * - Merges adjacent `$...$` regions joined by simple equation glue (`=`,
 *   `+`, `-`, `*`, `/`).
 * - After per-segment transformation, runs a global `widenMathSpans` post-pass
 *   that absorbs adjacent math-token glue across the original segment
 *   boundaries — fixes "partial-wrap" residue like `$x^{2} + y^{2}$ – 4x = 0`
 *   that the LLM emitted with only the prefix wrapped.
 * - Returns the original string unchanged if no Unicode-math triggers are
 *   present, so the function is safe to call on every text field.
 */
export function normalizeKatexMath(input: string | null | undefined): string {
	if (input == null) return "";
	const s = String(input);
	// Three independent triggers, any one engages the pipeline:
	//   - Unicode math chars present → per-segment Pass A/B/C
	//   - en/em-dash or mid-word split → global widen post-pass
	//   - any `$..$` block at all → global widen post-pass (catches LLM
	//     prefix-only wraps like `$y^{2}$ = 4x` where there's no other
	//     trigger present in the plain segment).
	const hasUnicode = HAS_UNICODE_MATH.test(s);
	const hasDashOrSplit = /[–—]|[A-Za-z]\$[^$]*\$[A-Za-z\s]?/.test(s);
	const hasDollarBlock = /\$[^$]*\$/.test(s);
	if (!hasUnicode && !hasDashOrSplit && !hasDollarBlock) return s;

	// Split on existing $...$ regions to preserve them untouched.
	const parts = s.split(/(\$[^$]*\$)/g);
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i] ?? "";
		if (p.length >= 2 && p.startsWith("$") && p.endsWith("$")) continue;
		parts[i] = transformPlainSegment(p);
	}
	return widenMathSpans(parts.join(""));
}

/** Exported for tests only. */
export const __test = { transformPlainSegment, widenMathSpans, HAS_UNICODE_MATH };
