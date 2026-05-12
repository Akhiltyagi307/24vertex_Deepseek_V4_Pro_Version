"use client";

import * as React from "react";
import katex from "katex";

import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.mjs";

import { LatexText } from "../../latex-text";
import type { ChemistryReactionSpec } from "@/lib/practice/visuals/types";

/**
 * `chemistry_reaction` renderer.
 *
 * Wraps the spec's mhchem string (`spec.ce`) inside `\\ce{...}` and asks
 * KaTeX to render it in display mode. mhchem is loaded via the side-effect
 * import in `latex-text.tsx` (and again here so the renderer works in
 * isolation). Parse failures fall back to a friendly placeholder.
 *
 * Why no LatexText reuse: LatexText is for inline `$...$` interpolated
 * inside prose. Reaction equations are display-mode and standalone, so
 * we render them directly via katex.renderToString.
 */
export function ChemistryReaction({
	spec,
}: {
	spec: ChemistryReactionSpec;
}): React.ReactElement {
	const html = React.useMemo<string | null>(() => {
		try {
			return katex.renderToString(`\\ce{${spec.ce}}`, {
				throwOnError: true,
				displayMode: true,
				strict: "ignore",
				trust: false,
				output: "html",
			});
		} catch {
			return null;
		}
	}, [spec.ce]);

	if (!html) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Could not render reaction.</span>
				<code className="text-xs">{spec.ce}</code>
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col items-center gap-1 px-2">
			{spec.label ? (
				<span className="text-muted-foreground text-xs">
					<LatexText text={spec.label} className="justify-center text-center" />
				</span>
			) : null}
			<div
				className="text-foreground [&_.katex]:text-base"
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	);
}
