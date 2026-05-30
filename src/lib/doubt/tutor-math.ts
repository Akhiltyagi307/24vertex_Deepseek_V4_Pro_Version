import { normalizeKatexMath } from "@/lib/practice/katex-math-normalize";

/**
 * Normalize tutor (LLM) Markdown so the chat renderer's `remark-math` +
 * `rehype-katex` pipeline typesets everything the model actually emits.
 *
 * Two problems this solves:
 *
 *  1. **Delimiter coverage.** `remark-math` only understands `$...$` / `$$...$$`,
 *     but DeepSeek frequently emits the LaTeX-conventional `\(...\)` (inline) and
 *     `\[...\]` (display) forms — which would otherwise render as literal
 *     backslash-paren text. We rewrite them to dollar delimiters.
 *
 *  2. **Unicode math in prose.** The model sometimes writes `x²`, `√34`, `±4`,
 *     `π`, `≤` as raw Unicode instead of LaTeX. {@link normalizeKatexMath}
 *     (shared with the practice pipeline) wraps those runs in `$...$`.
 *
 * Everything is done OUTSIDE code (fenced blocks + inline spans) and OUTSIDE
 * existing `$$...$$` display blocks, which are stashed behind placeholders so we
 * never rewrite a literal `\(` inside a code sample or mangle a hand-authored
 * display equation. Pure + deterministic; no LLM involved.
 */

// Private-use sentinel (U+E000), built at runtime so no invisible character
// lives in source. Each protected segment becomes `<SENTINEL><index><SENTINEL>`
// while the transforms run, then is restored verbatim. U+E000 will not appear
// in real tutor Markdown, so there is no collision risk.
const SENTINEL = String.fromCharCode(0xe000);
const PLACEHOLDER_RE = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g");

/** `\[...\]` → `$$...$$` (display), `\(...\)` → `$...$` (inline). */
function convertBracketDelimiters(text: string): string {
	return text
		.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner: string) => `$$${inner.trim()}$$`)
		.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner: string) => `$${inner}$`);
}

/**
 * Canonicalize every `$$...$$` into block form — `$$` on its own line, blank
 * lines around it.
 *
 * `remark-math` only renders `$$` as DISPLAY math when the fence stands on its
 * own line (flow context). A single-line `$$x = y$$` — which both the model and
 * the `\[...\]` conversion above emit — is otherwise parsed as inline, so a
 * derivation or integral renders small and mid-paragraph instead of centered.
 * Double-dollar always means display intent, so rewriting all of them is safe.
 */
function toDisplayBlocks(text: string): string {
	return text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, inner: string) => `\n\n$$\n${inner.trim()}\n$$\n\n`);
}

/**
 * Replace each match of `re` with a placeholder, stashing the original in
 * `store`. Run fenced blocks before inline code, and code before display math.
 */
function protect(text: string, re: RegExp, store: string[]): string {
	return text.replace(re, (match) => {
		const idx = store.length;
		store.push(match);
		return `${SENTINEL}${idx}${SENTINEL}`;
	});
}

export function normalizeTutorMarkdownMath(md: string): string {
	if (!md) return md;

	const store: string[] = [];

	// 1. Protect code first so delimiters/dollars inside code are never touched.
	//    Fenced blocks (``` or ~~~) before inline spans so a fence containing
	//    backticks isn't split by the inline pass.
	let out = protect(md, /(?:```[\s\S]*?```|~~~[\s\S]*?~~~)/g, store);
	out = protect(out, /(`+)[\s\S]*?\1/g, store);

	// 2. Convert LaTeX bracket delimiters to dollar delimiters, then canonicalize
	//    every `$$...$$` into block form so it renders as display (not inline).
	out = convertBracketDelimiters(out);
	out = toDisplayBlocks(out);

	// 3. Protect display math so the Unicode normalizer (which reasons about
	//    single-`$` regions) can't reach inside a `$$...$$` block.
	out = protect(out, /\$\$[\s\S]*?\$\$/g, store);

	// 4. Normalize Unicode math in the remaining prose / inline `$...$`.
	out = normalizeKatexMath(out);

	// 5. Restore protected segments (single pass; indices are unique and the
	//    stored segments contain no placeholders of their own).
	out = out.replace(PLACEHOLDER_RE, (_m, i: string) => store[Number(i)] ?? "");

	return out;
}
