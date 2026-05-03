"use client";

import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/** Illustrative pillar mix for marketing (scores 0–100; arc share ∝ value). */
const chartData = [{ topics: 78, sessions: 82, readiness: 76 }] as const;

/** Wide ramp so stacked bands read as three layers, not one muddy slab. */
const chartConfig = {
	topics: {
		label: "Topics",
		color: "color-mix(in oklab, var(--muted-foreground) 78%, #3ECF8E 22%)",
	},
	sessions: {
		label: "Session quality",
		color: "color-mix(in oklab, var(--muted-foreground) 34%, #3ECF8E 66%)",
	},
	readiness: {
		label: "Readiness",
		color: "#3ECF8E",
	},
} satisfies ChartConfig;

const segmentStroke =
	"color-mix(in oklab, var(--card) 55%, var(--muted) 45%)";

function meanScore(row: (typeof chartData)[number]) {
	return Math.round((row.topics + row.sessions + row.readiness) / 3);
}

const segmentKeys = ["topics", "sessions", "readiness"] as const;

const segmentLabel: Record<(typeof segmentKeys)[number], string> = {
	topics: "Topics",
	sessions: "Session quality",
	readiness: "Readiness",
};

type FeaturePerformanceRadialProps = {
	/** Tighter chart + legend for narrow bento cells (e.g. 2-column span). */
	compact?: boolean;
};

export function FeaturePerformanceRadial({ compact = false }: FeaturePerformanceRadialProps) {
	const row = chartData[0];
	const center = meanScore(row);

	return (
		<div
			className={cn(
				"flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5",
				compact ? "gap-2" : "flex-1",
			)}
		>
			<ChartContainer
				config={chartConfig}
				className={cn(
					"mx-auto w-full max-w-full [&_.recharts-polar-radius-axis-tick]:hidden [&_.recharts-polar-grid]:opacity-100",
					compact
						? "aspect-auto min-h-[9rem] w-full max-w-[min(100%,17.5rem)] medium:min-h-[10rem] medium:max-w-[min(100%,18.5rem)]"
						: "aspect-auto h-full min-h-[12.5rem] flex-1 medium:min-h-[13.5rem]",
				)}
				initialDimension={compact ? { width: 260, height: 168 } : { width: 320, height: 220 }}
				aria-label="Illustrative chart: topic, session, and readiness mix with an overall index."
			>
				<RadialBarChart
					data={[...chartData]}
					cx="50%"
					/* Default 82% sits low in the frame; compact bento reads better with the arc optically centered. */
					cy={compact ? "72%" : "82%"}
					startAngle={180}
					endAngle={0}
					innerRadius="56%"
					outerRadius="100%"
					margin={
						compact
							? { top: 4, right: 0, bottom: 2, left: 0 }
							: { top: 0, right: 2, bottom: 0, left: 2 }
					}
				>
					<PolarGrid
						gridType="circle"
						radialLines={false}
						stroke="color-mix(in oklab, var(--foreground) 14%, var(--border))"
						strokeOpacity={0.45}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideLabel
								formatter={(value, _name, item) => {
									const key = String(item.dataKey ?? "") as (typeof segmentKeys)[number];
									const label = segmentKeys.includes(key) ? segmentLabel[key] : key;
									return (
										<div className="flex w-full min-w-[10rem] justify-between gap-3 text-xs">
											<span className="text-muted-foreground">{label}</span>
											<span className="text-foreground font-mono font-medium tabular-nums">
												{typeof value === "number" ? `${value}%` : value}
											</span>
										</div>
									);
								}}
							/>
						}
					/>
					<RadialBar
						dataKey="topics"
						stackId="a"
						fill="var(--color-topics)"
						stroke={segmentStroke}
						strokeWidth={1.25}
						cornerRadius={1}
						isAnimationActive={false}
					/>
					<RadialBar
						dataKey="sessions"
						stackId="a"
						fill="var(--color-sessions)"
						stroke={segmentStroke}
						strokeWidth={1.25}
						cornerRadius={1}
						isAnimationActive={false}
					/>
					<RadialBar
						dataKey="readiness"
						stackId="a"
						fill="var(--color-readiness)"
						stroke={segmentStroke}
						strokeWidth={1.25}
						cornerRadius={1}
						isAnimationActive={false}
					/>
					<PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
						<Label
							content={({ viewBox }) => {
								if (viewBox && "cx" in viewBox && "cy" in viewBox) {
									const cx = viewBox.cx as number;
									const cy = viewBox.cy as number;
									return (
										<text x={cx} y={cy} textAnchor="middle" className="font-sans">
											<tspan
												x={cx}
												y={cy - 14}
												className="fill-foreground text-3xl font-semibold tracking-tight tabular-nums"
											>
												{center}
											</tspan>
											<tspan
												x={cx}
												y={cy + 10}
												className="fill-muted-foreground text-[11px] font-medium tracking-wide opacity-90"
											>
												Overall
											</tspan>
										</text>
									);
								}
								return null;
							}}
						/>
					</PolarRadiusAxis>
				</RadialBarChart>
			</ChartContainer>
			<div
				className={cn(
					"flex shrink-0 flex-nowrap items-center justify-center gap-y-0.5 px-0.5 tracking-tight",
					compact
						? "gap-x-2 medium:gap-x-2.5 text-xs text-[rgb(250,250,250)]"
						: "text-muted-foreground gap-x-3 text-[11px] font-medium medium:text-xs",
				)}
				aria-hidden
			>
				{segmentKeys.map((key) => (
					<span
						key={key}
						className={cn(
							"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap",
							compact && "font-normal",
						)}
					>
						<span
							className="size-1.5 shrink-0 rounded-full ring-1 ring-border/60"
							style={{ backgroundColor: chartConfig[key].color }}
						/>
						{segmentLabel[key]}
					</span>
				))}
			</div>
		</div>
	);
}
