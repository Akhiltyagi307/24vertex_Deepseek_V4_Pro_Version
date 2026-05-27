"use client";

import * as React from "react";
import functionPlot from "function-plot";

import type { MathFunctionPlotSpec } from "@/lib/practice/visuals/types";
import { LatexText } from "../../latex-text";
import { ChartAxisLatexLayout, visualMathNeedsKatex } from "../visual-math-text";

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

	const xLabel = spec.xLabel ?? "";
	const yLabel = spec.yLabel ?? "";
	const xMath = visualMathNeedsKatex(xLabel);
	const yMath = visualMathNeedsKatex(yLabel);

	React.useEffect(() => {
		const target = containerRef.current;
		if (!target) return undefined;
		target.replaceChildren();
		try {
			const yDomain: [number, number] | undefined =
				spec.yMin != null && spec.yMax != null && spec.yMax > spec.yMin
					? [spec.yMin, spec.yMax]
					: undefined;
			const xTicks =
				spec.xTickStep != null
					? buildTicks(spec.xMin, spec.xMax, spec.xTickStep)
					: undefined;
			const yTicks =
				spec.yTickStep != null && yDomain != null
					? buildTicks(yDomain[0], yDomain[1], spec.yTickStep)
					: undefined;
			const xAxis: Record<string, unknown> = {
				domain: [spec.xMin, spec.xMax],
				label: xMath ? "" : xLabel || undefined,
			};
			if (xTicks != null) xAxis.ticks = xTicks;
			const yAxis: Record<string, unknown> = {
				domain: yDomain,
				label: yMath ? "" : yLabel || undefined,
			};
			if (yTicks != null) yAxis.ticks = yTicks;
			functionPlot({
				target,
				width: PLOT_WIDTH,
				height: PLOT_HEIGHT,
				grid: true,
				disableZoom: true,
				xAxis: xAxis as never,
				yAxis: yAxis as never,
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
			if (target) target.replaceChildren();
		};
		// KaTeX flags derive from labels that live on `spec`.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- imperative plot keyed on full spec snapshot
	}, [spec]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
				<span>Unable to plot expression.</span>
				<code className="text-xs">{error}</code>
			</div>
		);
	}
	return (
		<ChartAxisLatexLayout xLabel={xMath ? xLabel : null} yLabel={yMath ? yLabel : null}>
			<div ref={containerRef} />
			<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				{spec.items
					.filter((item) => item.label != null && item.label.trim().length > 0)
					.map((item, idx) => {
						const color =
							item.color != null ? COLOR_MAP[item.color] : COLOR_MAP.primary;
						return (
							<div key={`legend-${idx}`} className="flex items-center gap-2 text-muted-foreground">
								<span
									aria-hidden="true"
									className="inline-block h-2.5 w-2.5 rounded-sm"
									style={{ backgroundColor: color }}
								/>
								<LatexText text={item.label!} />
							</div>
						);
					})}
			</div>
		</ChartAxisLatexLayout>
	);
}

function buildTicks(min: number, max: number, step: number): number[] {
	const ticks: number[] = [];
	if (step <= 0 || max <= min) return ticks;
	const start = Math.ceil(min / step) * step;
	for (let value = start; value <= max + 1e-9; value += step) {
		ticks.push(Number(value.toFixed(8)));
	}
	return ticks;
}
