"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";

import type { QuestionVisualKind } from "@/lib/practice/visuals/types";

/**
 * Class-component error boundary scoped to a single `<QuestionVisual>`
 * renderer. The renderers (smiles-drawer, function-plot, Plotly, Recharts,
 * Mafs, plain SVG) already wrap their imperative `useEffect` work in
 * try/catch and surface failures via local state, but if a renderer
 * throws during the render phase (e.g. a malformed prop crashes Recharts'
 * layout pass, or a TipTap update fires during reconciliation) the throw
 * would bubble to the segment-level `app/student/error.tsx` and take down
 * the whole question card.
 *
 * This boundary contains the blast radius to one figure: the rest of the
 * card (stem, options, MCQ controls) stays interactive, and the user just
 * sees a small "could not render this visual" fallback in place of the
 * broken figure. The error is reported to Sentry with the visual kind
 * tagged for easy aggregation by kind.
 *
 * Note: error boundaries only catch render-phase errors, not async errors
 * from useEffect or event handlers. The in-renderer try/catch blocks are
 * still required for those paths — this is defense in depth, not a
 * replacement.
 */

type Props = {
	children: React.ReactNode;
	kind: QuestionVisualKind;
	altText: string;
};

type State = {
	error: Error | null;
};

export class VisualErrorBoundary extends React.Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		Sentry.captureException(error, {
			tags: { component: "QuestionVisual", visualKind: this.props.kind },
			extra: {
				componentStack: errorInfo.componentStack ?? null,
				altText: this.props.altText,
			},
		});
	}

	render(): React.ReactNode {
		if (this.state.error == null) {
			return this.props.children;
		}
		// Fallback UI: a small textual placeholder with the same accessible
		// shape (role=img + aria-label) the renderer would have produced.
		// In dev, expose the kind + message inline so the cause is obvious
		// without a Sentry round-trip.
		const isDev = process.env.NODE_ENV !== "production";
		return (
			<div
				role="img"
				aria-label={this.props.altText || "Visual could not be displayed."}
				className="flex flex-col items-center gap-1 text-muted-foreground text-sm"
				data-visual-error-boundary-fallback="true"
			>
				<span>Could not render this visual.</span>
				{isDev ? (
					<code className="text-xs">
						{this.props.kind}: {this.state.error.message}
					</code>
				) : null}
			</div>
		);
	}
}
