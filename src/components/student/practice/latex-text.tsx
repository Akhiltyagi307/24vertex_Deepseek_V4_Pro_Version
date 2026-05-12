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

/**
 * Renders plain text with optional `$...$` inline fragments as KaTeX.
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
	const nodes = React.useMemo(() => {
		if (!text.includes("$")) {
			return [{ type: "text" as const, value: text }];
		}
		const parts = text.split(/(\$[^$]*\$)/g).filter((p) => p.length > 0);
		return parts.map((part) => {
			if (part.startsWith("$") && part.endsWith("$") && part.length >= 2) {
				return { type: "math" as const, value: part.slice(1, -1).trim() };
			}
			return { type: "text" as const, value: part };
		});
	}, [text]);

	return (
		<span className={cn("inline leading-relaxed", className)}>
			{nodes.map((node, i) => {
				if (node.type === "text") {
					return <span key={i}>{node.value}</span>;
				}
				const html = renderKatexFragment(node.value, displayMode);
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
