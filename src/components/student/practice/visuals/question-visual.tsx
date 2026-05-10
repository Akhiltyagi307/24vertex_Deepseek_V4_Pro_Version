"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

/**
 * Top-level question visual dispatcher.
 *
 * Renders a `<figure>` shell with the caption and an accessible aria-label
 * (using the spec's altText). The renderer body is dispatched on
 * `visual.spec.kind`. Each renderer batch (commits 6–9 of the v2 visuals
 * plan) registers a real component for its kind; until a kind has its
 * renderer wired, the body falls through to a small "not yet supported"
 * fallback so a stored envelope cannot crash the page.
 *
 * Server-side concerns: this component is a client component, but it
 * renders fine on the server too (no DOM-only APIs at the top level).
 * Heavy renderers (Mafs, Plotly, smiles-drawer, etc.) are imported via
 * `next/dynamic({ ssr: false })` inside their own renderer files so the
 * server bundle stays light.
 */
export function QuestionVisual({
	visual,
	className,
}: {
	visual: QuestionVisualEnvelope | null;
	className?: string;
}): React.ReactElement | null {
	if (!visual) return null;
	return (
		<figure
			role="figure"
			aria-label={visual.altText}
			className={cn(
				"my-4 flex w-full flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-3",
				className,
			)}
			data-question-visual
			data-question-visual-kind={visual.spec.kind}
		>
			<div className="flex min-h-[120px] w-full items-center justify-center overflow-x-auto">
				<RendererDispatch visual={visual} />
			</div>
			<figcaption className="text-muted-foreground text-center text-xs">
				{visual.caption}
			</figcaption>
		</figure>
	);
}

function RendererDispatch({
	visual,
}: {
	visual: QuestionVisualEnvelope;
}): React.ReactElement {
	const kind = visual.spec.kind;
	switch (kind) {
		default:
			// Fallback for kinds whose renderer hasn't shipped yet. Visible to
			// internal QA only; PRACTICE_VISUALS=false in production keeps the
			// model from emitting any visual until renderers land.
			return (
				<span className="text-muted-foreground text-sm" aria-hidden="true">
					Visual ({kind}) not yet supported on this client.
				</span>
			);
	}
}
