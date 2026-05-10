"use client";

import * as React from "react";
// `plotly.js-dist-min` ships zero TS types — declared as a bare module in
// `plotly.js-dist-min.d.ts`. We cast `Plotly` to a minimal local interface
// for the two methods we use; the rest of the API is intentionally `any`
// to avoid pulling the full plotly type pack into the bundle.
import PlotlyImport from "plotly.js-dist-min";

import type { StatisticsChartSpec } from "@/lib/practice/visuals/types";

type PlotlyApi = {
	newPlot: (
		el: HTMLElement,
		data: unknown[],
		layout: Record<string, unknown>,
		config: Record<string, unknown>,
	) => Promise<unknown> | unknown;
	purge: (el: HTMLElement) => void;
};

const Plotly = PlotlyImport as unknown as PlotlyApi;

/**
 * Box-plot sub-component for `statistics_chart` (subKind: "box").
 *
 * Wraps Plotly imperatively. Plotly is lazy-imported via next/dynamic in
 * statistics-chart.tsx so non-box stats charts pay no Plotly cost.
 */
export function StatisticsChartBox({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "box" }>;
}): React.ReactElement {
	const ref = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		const el = ref.current;
		if (!el) return undefined;
		const data = spec.groups.map((group) => ({
			type: "box" as const,
			name: group.name,
			q1: [group.q1],
			median: [group.median],
			q3: [group.q3],
			lowerfence: [group.min],
			upperfence: [group.max],
		}));
		const layout = {
			width: 480,
			height: 280,
			margin: { l: 60, r: 16, t: 16, b: 48 },
			xaxis: { title: { text: spec.xLabel } },
			yaxis: { title: { text: spec.yLabel } },
			showlegend: false,
		};
		void Plotly.newPlot(el, data, layout, {
			displayModeBar: false,
			responsive: true,
		});
		return () => {
			Plotly.purge(el);
		};
	}, [spec]);

	return <div ref={ref} className="w-full max-w-[480px]" />;
}
