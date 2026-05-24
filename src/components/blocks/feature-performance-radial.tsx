"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

type FeaturePerformanceRadialProps = {
	/** Tighter chart + legend for narrow bento cells (e.g. 2-column span). */
	compact?: boolean;
};

/**
 * Skeleton placeholder shown while the recharts chunk is fetched. Dimensions
 * mirror the rendered chart so the bento cell never shifts vertically when
 * the real component hydrates.
 */
function FeaturePerformanceRadialSkeleton({ compact = false }: FeaturePerformanceRadialProps) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5",
				compact ? "gap-2" : "flex-1",
			)}
			aria-hidden
		>
			<div
				className={cn(
					"animate-pulse rounded-md bg-muted/60",
					compact
						? "min-h-[9rem] w-full max-w-[min(100%,17.5rem)] medium:min-h-[10rem] medium:max-w-[min(100%,18.5rem)]"
						: "h-full min-h-[12.5rem] w-full flex-1 medium:min-h-[13.5rem]",
				)}
			/>
		</div>
	);
}

/**
 * Dynamic-loader wrapper for the marketing performance-radial chart.
 *
 * The heavy implementation imports `recharts` (~75KB gzip). Loading it via
 * `next/dynamic({ ssr: false })` keeps the chunk out of the landing /
 * marketing first-load bundle — the chart is well below-the-fold inside the
 * `features-8` block, so a brief skeleton on scroll-into-view is a perf
 * win, not a regression.
 *
 * The `loading` placeholder reserves the same height as the rendered chart
 * to prevent CLS when the chunk resolves.
 */
export const FeaturePerformanceRadial = dynamic(
	() =>
		import("./feature-performance-radial-impl").then((m) => ({
			default: m.FeaturePerformanceRadial,
		})),
	{
		ssr: false,
		loading: () => <FeaturePerformanceRadialSkeleton compact={false} />,
	},
) as React.ComponentType<FeaturePerformanceRadialProps>;
