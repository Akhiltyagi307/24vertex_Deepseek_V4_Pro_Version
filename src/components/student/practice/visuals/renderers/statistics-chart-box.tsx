"use client";

import * as React from "react";
import Plotly from "plotly.js-dist-min";

import type { StatisticsChartSpec } from "@/lib/practice/visuals/types";

/**
 * Box-plot sub-component for `statistics_chart` (subKind: "box").
 *
 * Wraps Plotly imperatively. Plotly is lazy-imported via React.lazy in
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
		void Plotly.newPlot(el, data as unknown as Plotly.Data[], layout, {
			displayModeBar: false,
			responsive: true,
		});
		return () => {
			Plotly.purge(el);
		};
	}, [spec]);

	return <div ref={ref} className="w-full max-w-[480px]" />;
}
