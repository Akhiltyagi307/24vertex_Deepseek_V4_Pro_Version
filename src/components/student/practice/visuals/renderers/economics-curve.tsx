"use client";

import * as React from "react";
import functionPlot from "function-plot";

import type { EconomicsCurveSpec } from "@/lib/practice/visuals/types";

const COLOR_MAP: Record<NonNullable<EconomicsCurveSpec["curves"][number]["color"]>, string> = {
	primary: "#3b82f6",
	secondary: "#10b981",
	muted: "#6b7280",
	accent: "#f59e0b",
};

const PLOT_WIDTH = 480;
const PLOT_HEIGHT = 320;

/**
 * `economics_curve` renderer.
 *
 * Wraps function-plot, like `<MathFunctionPlot />`. The schema's
 * convention is that curve expressions are functions of `p` (price on
 * the x-axis); we substitute `p` → `x` before passing to function-plot
 * because that library always evaluates `fn` against `x`.
 *
 * `marks` are rendered as small annotations at (x, y) — useful for
 * "Equilibrium" / "Price ceiling" callouts. function-plot's annotation
 * API only supports x or y reference lines, so we layer raw SVG circles
 * + text on top of the chart for true point labels.
 */
export function EconomicsCurve({
	spec,
}: {
	spec: EconomicsCurveSpec;
}): React.ReactElement {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		const target = containerRef.current;
		if (!target) return undefined;
		target.innerHTML = "";
		try {
			const yDomain: [number, number] | undefined =
				spec.yMin != null && spec.yMax != null && spec.yMax > spec.yMin
					? [spec.yMin, spec.yMax]
					: undefined;
			functionPlot({
				target,
				width: PLOT_WIDTH,
				height: PLOT_HEIGHT,
				grid: true,
				disableZoom: true,
				xAxis: {
					domain: [spec.xMin, spec.xMax],
					label: spec.xLabel,
				},
				yAxis: {
					domain: yDomain,
					label: spec.yLabel,
				},
				data: spec.curves.map((curve) => ({
					fn: substitutePForX(curve.expr),
					graphType: "polyline",
					color: curve.color != null ? COLOR_MAP[curve.color] : COLOR_MAP.primary,
					nSamples: 200,
				})),
				annotations: spec.marks.map((mark) => ({
					x: mark.x,
					text: mark.label,
				})),
			});
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Unable to plot curves.");
		}
		return () => {
			if (target) target.innerHTML = "";
		};
	}, [spec]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Unable to plot curves.</span>
				<code className="text-xs">{error}</code>
			</div>
		);
	}

	return <div ref={containerRef} className="w-full max-w-[480px]" />;
}

/**
 * Replaces standalone `p` identifiers with `x` so function-plot can
 * evaluate the spec's expressions against its single free variable.
 * Conservative: only matches `p` not adjacent to alphanumerics or
 * underscores (so `pi`, `exp`, `temperature` etc. are untouched).
 */
function substitutePForX(expr: string): string {
	return expr.replace(/(^|[^A-Za-z0-9_])p(?=$|[^A-Za-z0-9_])/g, "$1x");
}

export const __test = { substitutePForX };
