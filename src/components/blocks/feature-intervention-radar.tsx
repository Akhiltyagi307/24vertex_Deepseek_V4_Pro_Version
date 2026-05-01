"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** Illustrative subject snapshot for marketing (percent of syllabus touched vs mastered). */
const chartData = [
	{ subject: "Math", coverage: 92, perfected: 71 },
	{ subject: "Physics", coverage: 78, perfected: 52 },
	{ subject: "Chemistry", coverage: 84, perfected: 61 },
	{ subject: "Biology", coverage: 72, perfected: 45 },
	{ subject: "English", coverage: 88, perfected: 66 },
] as const;

const chartConfig = {
	coverage: {
		label: "Topic coverage",
		color: "color-mix(in oklab, #3ECF8E 32%, var(--muted-foreground))",
	},
	perfected: {
		label: "Topics perfected",
		color: "#3ECF8E",
	},
} satisfies ChartConfig;

export function FeatureInterventionRadar() {
	return (
		<ChartContainer
			config={chartConfig}
			className={cn(
				"mx-auto w-full max-w-[min(100%,260px)]",
				"aspect-[5/4] max-h-[200px] sm:max-h-[220px]",
				"[&_.recharts-polar-angle-axis-tick_text]:fill-muted-foreground",
				"[&_.recharts-legend-item-text]:text-[rgb(250,250,250)]",
			)}
			initialDimension={{ width: 280, height: 220 }}
		>
			<RadarChart
				data={[...chartData]}
				margin={{ top: 10, right: 18, bottom: 4, left: 18 }}
				outerRadius="72%"
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
										{item.dataKey === "coverage" ? "Topic coverage" : "Topics perfected"}
									</span>
									<span className="text-foreground font-mono font-medium tabular-nums">
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
					tick={{ fontSize: 10, fontWeight: 500 }}
				/>
				<PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
				<Radar
					name={chartConfig.coverage.label as string}
					dataKey="coverage"
					stroke="var(--color-coverage)"
					fill="var(--color-coverage)"
					fillOpacity={0.28}
					strokeWidth={1.25}
					isAnimationActive={false}
				/>
				<Radar
					name={chartConfig.perfected.label as string}
					dataKey="perfected"
					stroke="var(--color-perfected)"
					fill="var(--color-perfected)"
					fillOpacity={0.42}
					strokeWidth={1.5}
					isAnimationActive={false}
				/>
				<ChartLegend
					verticalAlign="bottom"
					className="mt-1 gap-3 text-xs text-[rgb(250,250,250)] sm:gap-4"
					content={<ChartLegendContent />}
				/>
			</RadarChart>
		</ChartContainer>
	);
}
