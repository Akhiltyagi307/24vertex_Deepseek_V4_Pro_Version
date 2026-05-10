"use client";

import * as React from "react";
import functionPlot from "function-plot";

import type { MathFunctionPlotSpec } from "@/lib/practice/visuals/types";

const COLOR_MAP: Record<NonNullable<MathFunctionPlotSpec["items"][number]["color"]>, string> = {
	primary: "#3b82f6",
	secondary: "#10b981",
	muted: "#6b7280",
	accent: "#f59e0b",
};

const PLOT_WIDTH = 480;
const PLOT_HEIGHT = 320;

/**
 * `math_function_plot` renderer.
 *
 * Wraps function-plot (d3-based) in a React component. We mount the chart
 * imperatively in a `useEffect`, recompute on spec changes, and tear down
 * cleanly on unmount. Bad expressions are guarded with try/catch and fall
 * back to a small "unable to plot" message rather than crashing the page.
 */
export function MathFunctionPlot({
	spec,
}: {
	spec: MathFunctionPlotSpec;
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
					label: spec.xLabel ?? undefined,
				},
				yAxis: {
					domain: yDomain,
					label: spec.yLabel ?? undefined,
				},
				data: spec.items.map((item) => ({
					fn: item.expr,
					graphType: "polyline",
					color: item.color != null ? COLOR_MAP[item.color] : COLOR_MAP.primary,
					nSamples: 200,
				})),
			});
			setError(null);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Unable to plot.";
			setError(message);
		}
		return () => {
			if (target) target.innerHTML = "";
		};
	}, [spec]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Unable to plot expression.</span>
				<code className="text-xs">{error}</code>
			</div>
		);
	}
	return <div ref={containerRef} className="w-full max-w-[480px]" />;
}
