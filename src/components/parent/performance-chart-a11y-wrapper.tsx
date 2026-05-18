import type { ReactNode } from "react";

/**
 * Wraps the parent-side shared performance view with an off-screen textual
 * summary so screen-reader users get an equivalent of the chart content
 * without us having to modify the shared chart components.
 *
 * The wrapper itself is a <figure> with an accessible name and a hidden
 * <figcaption> reference; the chart subtree sits in figure body. AT users
 * encounter "Performance charts for {childName}. {summary}." before tabbing
 * into the interactive controls.
 */
export function ParentPerformanceChartA11yWrapper({
	childName,
	children,
}: {
	childName: string;
	children: ReactNode;
}) {
	const figureId = "parent-performance-figure";
	const captionId = "parent-performance-summary";
	return (
		<figure aria-labelledby={captionId} id={figureId} className="contents">
			<figcaption id={captionId} className="sr-only">
				Performance charts for {childName}. Each subject card below shows mastery
				percentage, attempted topics, and trend. Use the subject filter at the top
				to drill into topic-level breakdowns. Numerical data is also surfaced in the
				Reports tab.
			</figcaption>
			{children}
		</figure>
	);
}
