"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	subjectTopicRadarChartConfig,
	type SubjectTopicRadarDatum,
} from "@/lib/charts/subject-topic-radar-config";
import { cn } from "@/lib/utils";

// The `SubjectTopicRadarDatum` type re-export lives on the public wrapper
// (`./subject-topic-radar-chart.tsx`) so consumers import both the component
// and the type from a single stable path. This impl file is private — direct
// imports should be avoided so the dynamic-load contract is preserved.

type SubjectTopicRadarChartProps = {
	data: SubjectTopicRadarDatum[];
	/** Marketing bento uses light legend text; dashboard uses theme tokens. */
	variant?: "marketing" | "dashboard";
	/** Grow to fill a flex parent (e.g. dashboard Topic progress card) instead of intrinsic max dimensions. */
	fillHeight?: boolean;
	className?: string;
	initialDimension?: { width: number; height: number };
};

function truncateSubjectLabel(name: string, maxLen: number): string {
	if (name.length <= maxLen) return name;
	return `${name.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function SubjectTopicRadarChart({
	data,
	variant = "dashboard",
	fillHeight = false,
	className,
	initialDimension = { width: 280, height: 220 },
}: SubjectTopicRadarChartProps) {
	const chartData = React.useMemo(() => data.map((d) => ({ ...d })), [data]);
	const tickMaxLen = data.length > 8 ? 10 : data.length > 6 ? 12 : 24;

	const legendTickClass =
		variant === "marketing"
			? "[&_.recharts-legend-item-text]:text-[rgb(250,250,250)]"
			: "[&_.recharts-legend-item-text]:text-muted-foreground";

	const legendRowClass =
		variant === "marketing"
			? "mt-1 gap-3 text-xs text-[rgb(250,250,250)] medium:gap-4"
			: fillHeight
				? "mt-0.5 gap-2 text-[0.6875rem] text-muted-foreground medium:gap-3 medium:text-xs"
				: "mt-1 gap-3 text-xs text-muted-foreground medium:gap-4";

	const tickFontSize = data.length > 10 ? 8 : data.length > 7 ? 9 : 10;

	const radarMargin = fillHeight
		? { top: 4, right: 6, bottom: 6, left: 6 }
		: { top: 10, right: 18, bottom: 4, left: 18 };

	const outerRadius = fillHeight ? "78%" : "72%";

	return (
		<ChartContainer
			config={subjectTopicRadarChartConfig}
			className={cn(
				fillHeight
					? "mx-auto h-full min-h-0 w-full max-w-none flex-1 items-start justify-center aspect-auto"
					: "mx-auto w-full max-w-[min(100%,260px)] aspect-[5/4] max-h-[200px] medium:max-h-[220px]",
				"[&_.recharts-polar-angle-axis-tick_text]:fill-muted-foreground",
				legendTickClass,
				className,
			)}
			initialDimension={fillHeight ? { width: 320, height: 280 } : initialDimension}
		>
			<RadarChart
				data={chartData}
				margin={radarMargin}
				outerRadius={outerRadius}
				cx="50%"
				cy={fillHeight ? "47%" : "50%"}
			>
				<ChartTooltip
					cursor={false}
					content={
						<ChartTooltipContent
							indicator="line"
							labelKey="subject"
							formatter={(value, _name, item) => (
								<div className="flex w-full min-w-[10rem] justify-between gap-3 text-xs">
									<span className="text-muted-foreground">
										{item.dataKey === "coverage"
											? (subjectTopicRadarChartConfig.coverage.label as string)
											: (subjectTopicRadarChartConfig.perfected.label as string)}
									</span>
									<span className="font-mono font-medium text-foreground tabular-nums">
										{typeof value === "number" ? `${value}%` : value}
									</span>
								</div>
							)}
						/>
					}
				/>
				<PolarGrid
					radialLines
					stroke="color-mix(in oklab, var(--foreground) 26%, var(--border))"
					strokeOpacity={0.62}
					strokeWidth={1}
				/>
				<PolarAngleAxis
					dataKey="subject"
					tickLine={false}
					tick={{ fontSize: tickFontSize, fontWeight: 500 }}
					tickFormatter={(value) => truncateSubjectLabel(String(value), tickMaxLen)}
				/>
				<PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
				<Radar
					name={subjectTopicRadarChartConfig.coverage.label as string}
					dataKey="coverage"
					stroke="var(--color-coverage)"
					fill="var(--color-coverage)"
					fillOpacity={0.28}
					strokeWidth={1.25}
					isAnimationActive={false}
				/>
				<Radar
					name={subjectTopicRadarChartConfig.perfected.label as string}
					dataKey="perfected"
					stroke="var(--color-perfected)"
					fill="var(--color-perfected)"
					fillOpacity={0.42}
					strokeWidth={1.5}
					isAnimationActive={false}
				/>
				<ChartLegend verticalAlign="bottom" className={legendRowClass} content={<ChartLegendContent />} />
			</RadarChart>
		</ChartContainer>
	);
}
