"use client";

import * as React from "react";
import katex from "katex";

import "katex/dist/katex.min.css";
// Enables mhchem (\\ce{...}, \\pu{...}) for chemistry equations rendered
// inside answer keys, explanations, and any future chemistry_reaction
// visual that uses KaTeX. No new dependency — ships with `katex`.
import "katex/dist/contrib/mhchem.mjs";

import { parseLatexNodes } from "@/lib/practice/parse-latex-nodes";
import { cn } from "@/lib/utils";

export { parseLatexNodes } from "@/lib/practice/parse-latex-nodes";

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
