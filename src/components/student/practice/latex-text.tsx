"use client";

import * as React from "react";
import katex from "katex";

import "katex/dist/katex.min.css";
// Enables mhchem (\\ce{...}, \\pu{...}) for chemistry equations rendered
// inside answer keys, explanations, and any future chemistry_reaction
// visual that uses KaTeX. No new dependency — ships with `katex`.
import "katex/dist/contrib/mhchem.mjs";

import { cn } from "@/lib/utils";

function renderKatexFragment(tex: string, displayMode: boolean): string | null {
	try {
		// trust:false keeps \\url/\\href and raw HTML out of KaTeX output; bounds XSS if question text is compromised.
		return katex.renderToString(tex, {
			throwOnError: true,
			displayMode,
			strict: "ignore",
			trust: false,
			output: "html",
		});
	} catch {
		return null;
	}
}

type LatexNode =
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
 * Exported for unit testing.
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

/**
 * Renders plain text with optional KaTeX math fragments. Supports four
 * delimiter conventions — see {@link parseLatexNodes}. The `displayMode`
 * prop forces ALL math fragments to render as block math even when they
 * arrived via inline delimiters.
 */
export function LatexText({
	text,
	className,
	displayMode = false,
}: {
	text: string;
	className?: string;
	displayMode?: boolean;
}) {
	const nodes = React.useMemo(() => parseLatexNodes(text), [text]);

	return (
		<span className={cn("inline leading-relaxed", className)}>
			{nodes.map((node, i) => {
				if (node.type === "text") {
					return <span key={i}>{node.value}</span>;
				}
				const isDisplay = displayMode || node.display;
				const html = renderKatexFragment(node.value, isDisplay);
				if (!html) {
					return (
						<code key={i} className="bg-muted rounded px-1 py-0.5 text-[0.9em]">
							{node.value}
						</code>
					);
				}
				return (
					<span
						key={i}
						className="[&_.katex]:text-[1em]"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				);
			})}
		</span>
	);
}
