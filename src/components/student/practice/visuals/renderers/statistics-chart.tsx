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
	Legend,
	LabelList,
} from "recharts";

import type { StatisticsChartSpec } from "@/lib/practice/visuals/types";
import { ChartAxisLatexLayout, visualMathNeedsKatex } from "../visual-math-text";

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
	const summary = spec.bins.map((bin) => `${bin.label}: ${bin.frequency}`).join(", ");
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<BarChart
					data={spec.bins.map((bin) => ({ label: bin.label, value: bin.frequency }))}
					margin={{ top: 8, right: 16, bottom: 24, left: 16 }}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						dataKey="label"
						tickLine={false}
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						allowDecimals={false}
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip />
					<Bar dataKey="value" fill="#3b82f6">
						<LabelList dataKey="value" position="top" fontSize={10} />
					</Bar>
				</BarChart>
			</ResponsiveContainer>
			<p className="sr-only">{summary}</p>
		</ChartAxisLatexLayout>
	);
}

function BarSimple({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "bar" }>;
}): React.ReactElement {
	const summary = spec.data.map((row) => `${row.label}: ${row.value}`).join(", ");
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<BarChart data={spec.data} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						dataKey="label"
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip />
					<Bar dataKey="value" fill="#10b981">
						<LabelList dataKey="value" position="top" fontSize={10} />
					</Bar>
				</BarChart>
			</ResponsiveContainer>
			<p className="sr-only">{summary}</p>
		</ChartAxisLatexLayout>
	);
}

function LineSeries({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "line" }>;
}): React.ReactElement {
	const merged = mergeLineSeries(spec.series);
	const summary = spec.series.map((series) => series.name).join(", ");
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={merged} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						dataKey="x"
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip />
					<Legend />
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
			<p className="sr-only">{summary}</p>
		</ChartAxisLatexLayout>
	);
}

function ScatterPoints({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "scatter" }>;
}): React.ReactElement {
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						type="number"
						dataKey="x"
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						type="number"
						dataKey="y"
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip cursor={{ strokeDasharray: "3 3" }} />
					<Scatter data={spec.points} fill="#3b82f6" />
				</ScatterChart>
			</ResponsiveContainer>
		</ChartAxisLatexLayout>
	);
}

function PieSlices({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "pie" }>;
}): React.ReactElement {
	const total = spec.slices.reduce((sum, slice) => sum + slice.value, 0);
	const summary = spec.slices
		.map((slice) => {
			const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
			return `${slice.label} (${pct}%)`;
		})
		.join(", ");
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
			<p className="sr-only">{summary}</p>
		</div>
	);
}

function FrequencyPolygon({
	spec,
}: {
	spec: Extract<StatisticsChartSpec, { subKind: "frequency_polygon" }>;
}): React.ReactElement {
	const points = spec.bins.map((bin) => ({ label: bin.label, value: bin.frequency }));
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={points} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						dataKey="label"
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip />
					<Line type="linear" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot />
				</LineChart>
			</ResponsiveContainer>
		</ChartAxisLatexLayout>
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
	const xMath = visualMathNeedsKatex(spec.xLabel);
	const yMath = visualMathNeedsKatex(spec.yLabel);
	return (
		<ChartAxisLatexLayout xLabel={xMath ? spec.xLabel : null} yLabel={yMath ? spec.yLabel : null}>
			<ResponsiveContainer width="100%" height={CHART_HEIGHT}>
				<LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 16 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
					<XAxis
						dataKey="label"
						label={
							xMath
								? undefined
								: { value: spec.xLabel, position: "insideBottom", offset: -8 }
						}
					/>
					<YAxis
						label={
							yMath
								? undefined
								: { value: spec.yLabel, angle: -90, position: "insideLeft" }
						}
					/>
					<Tooltip />
					<Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot />
				</LineChart>
			</ResponsiveContainer>
		</ChartAxisLatexLayout>
	);
}

function renderPieSliceLabel(props: {
	name?: string | number;
	percent?: number;
}): string {
	const name =
		typeof props.name === "number"
			? String(props.name)
			: (props.name ?? "");
	if (!name) return "";
	const pct =
		typeof props.percent === "number"
			? Math.round(props.percent * 100)
			: null;
	return pct != null ? `${name} (${pct}%)` : name;
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
