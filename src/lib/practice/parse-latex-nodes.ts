export type LatexNode =
	| { type: "text"; value: string }
	| { type: "math"; value: string; display: boolean };

/**
 * Tokenises `text` into alternating text + math nodes. Recognises (in
 * priority order):
 *
 *   `$$...$$` — display math (block, centered).
 *   `\[...\]` — display math (LaTeX-conventional).
 *   `$...$`   — inline math (the convention the LLM is instructed to use).
 *   `\(...\)` — inline math (LaTeX-conventional alternative).
 *
 * Recognising `$$..$$` BEFORE `$..$` is critical — splitting on single `$`
 * would parse `$$x$$` as empty + `x` + empty + content + empty, mangling
 * display math.
 *
 * Shared by web `LatexText` and PDF `PdfLatexText`.
 */
export function parseLatexNodes(text: string): LatexNode[] {
	if (!text || (!text.includes("$") && !text.includes("\\(") && !text.includes("\\["))) {
		return [{ type: "text", value: text }];
	}
	const RE = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]*\$|\\\([\s\S]*?\\\))/g;
	const out: LatexNode[] = [];
	let cursor = 0;
	let m: RegExpExecArray | null;
	while ((m = RE.exec(text)) != null) {
		if (m.index > cursor) {
			out.push({ type: "text", value: text.slice(cursor, m.index) });
		}
		const tok = m[0];
		if (tok.startsWith("$$") && tok.endsWith("$$") && tok.length >= 4) {
			out.push({ type: "math", value: tok.slice(2, -2).trim(), display: true });
		} else if (tok.startsWith("\\[") && tok.endsWith("\\]")) {
			out.push({ type: "math", value: tok.slice(2, -2).trim(), display: true });
		} else if (tok.startsWith("\\(") && tok.endsWith("\\)")) {
			out.push({ type: "math", value: tok.slice(2, -2).trim(), display: false });
		} else if (tok.startsWith("$") && tok.endsWith("$") && tok.length >= 2) {
			out.push({ type: "math", value: tok.slice(1, -1).trim(), display: false });
		} else {
			out.push({ type: "text", value: tok });
		}
		cursor = m.index + tok.length;
	}
	if (cursor < text.length) {
		out.push({ type: "text", value: text.slice(cursor) });
	}
	return out.filter((n) => !(n.type === "text" && n.value === ""));
}
