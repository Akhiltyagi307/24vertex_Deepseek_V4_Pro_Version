"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	LineChart,
	Line,
	ScatterChart,
	Scatter,
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	CartesianGrid,
} from "recharts";

import type { StatisticsChartSpec } from "@/lib/practice/visuals/types";

const CHART_HEIGHT = 280;
const PIE_COLORS = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#06b6d4",
	"#84cc16",
	"#ec4899",
	"#f97316",
	"#14b8a6",
];

/**
 * `statistics_chart` renderer. Eight sub-kinds; most go through Recharts
 * (already in the bundle). Box plot uses Plotly via a thin imperative
 * wrapper, dynamically imported so non-box stats charts pay no Plotly
 * cost.
 */
export function StatisticsChart({
	spec,
}: {
	spec: StatisticsChartSpec;
}): React.ReactElement {
	switch (spec.subKind) {
		case "histogram":
			return <Histogram spec={spec} />;
		case "bar":
			return <BarSimple spec={spec} />;
		case "line":
			return <LineSeries spec={spec} />;
		case "scatter":
			return <ScatterPoints spec={spec} />;
		case "pie":
			return <PieSlices spec={spec} />;
		case "frequency_polygon":
			return <FrequencyPolygon spec={spec} />;
		case "ogive":
			return <Ogive spec={spec} />;
		case "box":
			return <BoxPlotDynamic spec={spec} />;
	}
}

const BoxPlotDynamic = dynamic(
	() =>
		import("./statistics-chart-box").then((m) => ({ default: m.StatisticsChartBox })),
	{
		ssr: false,
		loading: () => (
			<div
				className="bg-muted/40 flex h-[280px] w-full max-w-[480px] items-center justify-center rounded text-muted-foreground text-sm"
				aria-hidden="true"
			>
				Loading box plot…
			</div>
		),
	},
);

function Histogram({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "histogram" }>;
}): React.ReactElement {
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<BarChart
					data={spec.bins.map((bin) => ({ label: bin.label, value: bin.frequency }))}
					margin={{ top: 8, right: 16, bottom: 24, left: 16 }}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis dataKey="label" tickLine={false} label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis allowDecimals={false} label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip />
					<Bar dataKey="value" fill="#3b82f6" />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

function BarSimple({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "bar" }>;
}): React.ReactElement {
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<BarChart data={spec.data} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis dataKey="label" label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip />
					<Bar dataKey="value" fill="#10b981" />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

function LineSeries({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "line" }>;
}): React.ReactElement {
	const merged = mergeLineSeries(spec.series);
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={merged} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis dataKey="x" label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip />
					{spec.series.map((s, i) => (
						<Line
							key={s.name}
							type="monotone"
							dataKey={s.name}
							stroke={PIE_COLORS[i % PIE_COLORS.length]}
							dot={false}
							strokeWidth={2}
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

function ScatterPoints({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "scatter" }>;
}): React.ReactElement {
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis type="number" dataKey="x" label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis type="number" dataKey="y" label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip cursor={{ strokeDasharray: "3 3" }} />
					<Scatter data={spec.points} fill="#3b82f6" />
				</ScatterChart>
			</ResponsiveContainer>
		</div>
	);
}

function PieSlices({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "pie" }>;
}): React.ReactElement {
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
					<Tooltip />
					<Pie
						data={spec.slices}
						dataKey="value"
						nameKey="label"
						outerRadius={100}
						label={renderPieSliceLabel}
					>
						{spec.slices.map((_, i) => (
							<Cell key={`p-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
						))}
					</Pie>
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}

function FrequencyPolygon({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "frequency_polygon" }>;
}): React.ReactElement {
	const points = spec.bins.map((bin) => ({ label: bin.label, value: bin.frequency }));
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={points} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis dataKey="label" label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip />
					<Line type="linear" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot />
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

function Ogive({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "ogive" }>;
}): React.ReactElement {
	const cumulative: number[] = [];
	if (spec.cumulative === "less_than") {
		let acc = 0;
		for (const bin of spec.bins) {
			acc += bin.frequency;
			cumulative.push(acc);
		}
	} else {
		const total = spec.bins.reduce((s, bin) => s + bin.frequency, 0);
		let acc = 0;
		for (const bin of spec.bins) {
			cumulative.push(total - acc);
			acc += bin.frequency;
		}
	}
	const data = spec.bins.map((bin, i) => ({ label: bin.label, value: cumulative[i] }));
	return (
		<div className="w-full max-w-[480px]">
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis dataKey="label" label={{ value: spec.xLabel, position: "insideBottom", offset: -8 }} />
					<YAxis label={{ value: spec.yLabel, angle: -90, position: "insideLeft" }} />
					<Tooltip />
					<Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot />
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

function renderPieSliceLabel(props: { name?: string | number; value?: number }): string {
	if (typeof props.name === "string") return props.name;
	if (typeof props.name === "number") return String(props.name);
	return "";
}

function mergeLineSeries(series: { name: string; points: { x: number; y: number }[] }[]) {
	const out = new Map<number, Record<string, number>>();
	for (const s of series) {
		for (const p of s.points) {
			const row = out.get(p.x) ?? { x: p.x };
			row[s.name] = p.y;
			out.set(p.x, row);
		}
	}
	return [...out.values()].sort((a, b) => (a.x as number) - (b.x as number));
}
