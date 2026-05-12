"use client";

import * as React from "react";

import { LatexText } from "../../latex-text";
import type { EnglishPassageSpec } from "@/lib/practice/visuals/types";

/**
 * `english_passage` renderer.
 *
 * Line-numbered prose for unseen comprehension passages, poetry
 * excerpts, drama dialogue. Each line carries an explicit `number`
 * (often 1, 2, 3… but the model can label every fifth line, etc.) and
 * `text` that can include inline `$...$` LaTeX fragments (rare for
 * English but supported via LatexText for parity with the stem).
 *
 * Title and source are optional. We render them in a small caption
 * style so the figure shell's primary caption (set by the dispatcher)
 * carries the high-level label and these provide attribution.
 */
export function EnglishPassage({
	spec,
}: {
	spec: EnglishPassageSpec;
}): React.ReactElement {
	return (
		<div className="w-full max-w-[640px]">
			{spec.title ? (
				<div className="text-foreground mb-1 text-center text-sm font-semibold">
					<LatexText text={spec.title} className="justify-center text-center" />
				</div>
			) : null}
			{spec.source ? (
				<div className="text-muted-foreground mb-2 text-center text-xs italic">
					<LatexText text={spec.source} className="justify-center text-center" />
				</div>
			) : null}
			<div className="flex flex-col gap-1 text-foreground text-sm leading-relaxed">
				{spec.lines.map((line) => (
					<div key={`l-${line.number}`} className="flex items-start gap-3">
						<span className="text-muted-foreground tabular-nums w-8 shrink-0 select-none text-right text-xs">
							{line.number}
						</span>
						<LatexText text={line.text} className="flex-1" />
					</div>
				))}
			</div>
		</div>
	);
}
