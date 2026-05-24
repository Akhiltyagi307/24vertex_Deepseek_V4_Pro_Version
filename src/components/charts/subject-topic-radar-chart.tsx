"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

import type { SubjectTopicRadarDatum } from "@/lib/charts/subject-topic-radar-config";

export type { SubjectTopicRadarDatum } from "@/lib/charts/subject-topic-radar-config";

type SubjectTopicRadarChartProps = {
	data: SubjectTopicRadarDatum[];
	/** Marketing bento uses light legend text; dashboard uses theme tokens. */
	variant?: "marketing" | "dashboard";
	/** Grow to fill a flex parent (e.g. dashboard Topic progress card) instead of intrinsic max dimensions. */
	fillHeight?: boolean;
	className?: string;
	initialDimension?: { width: number; height: number };
};

/**
 * Skeleton that mirrors the rendered chart's dimensions so the dashboard /
 * marketing layout doesn't shift when the recharts chunk resolves.
 */
function SubjectTopicRadarChartSkeleton({
	fillHeight = false,
	className,
}: Pick<SubjectTopicRadarChartProps, "fillHeight" | "className">) {
	return (
		<div
			className={cn(
				"flex min-h-0 w-full items-center justify-center",
				fillHeight
					? "mx-auto h-full min-h-0 w-full max-w-none flex-1 aspect-auto"
					: "mx-auto w-full max-w-[min(100%,260px)] aspect-[5/4] max-h-[200px] medium:max-h-[220px]",
				className,
			)}
			aria-hidden
		>
			<div className="size-full animate-pulse rounded-md bg-muted/60" />
		</div>
	);
}

/**
 * Dynamic-loader wrapper for the dashboard + marketing topic-progress radar.
 *
 * The implementation imports `recharts` (~75KB gzip). Loading via
 * `next/dynamic({ ssr: false })` keeps that chunk out of the
 * `/student/dashboard` and landing-bento first-load bundles. The
 * `loading` placeholder reserves the same dimensions as the rendered
 * chart so layout doesn't shift when the chunk resolves.
 */
export const SubjectTopicRadarChart = dynamic(
	() =>
		import("./subject-topic-radar-chart-impl").then((m) => ({
			default: m.SubjectTopicRadarChart,
		})),
	{
		ssr: false,
		loading: () => <SubjectTopicRadarChartSkeleton fillHeight />,
	},
) as React.ComponentType<SubjectTopicRadarChartProps>;
