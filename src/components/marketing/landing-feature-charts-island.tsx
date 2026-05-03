"use client";

import dynamic from "next/dynamic";

import { LazyVisible } from "@/components/util/lazy-visible";

/**
 * Recharts (~150 KB) lazy-loaded for landing-page bento charts. The two charts
 * appear only in the Features section; lazy-mounting on viewport entry keeps the
 * landing's first-paint chunk lean.
 */
const FeaturePerformanceRadial = dynamic(
	() =>
		import("@/components/blocks/feature-performance-radial").then((m) => ({
			default: m.FeaturePerformanceRadial,
		})),
	{ ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" /> },
);

const FeatureInterventionRadar = dynamic(
	() =>
		import("@/components/blocks/feature-intervention-radar").then((m) => ({
			default: m.FeatureInterventionRadar,
		})),
	{ ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" /> },
);

export function FeaturePerformanceRadialIsland({ compact }: { compact?: boolean }) {
	return (
		<LazyVisible className="flex h-full min-h-0 w-full items-center justify-center">
			<FeaturePerformanceRadial compact={compact} />
		</LazyVisible>
	);
}

export function FeatureInterventionRadarIsland() {
	return (
		<LazyVisible className="flex h-full min-h-0 w-full items-center justify-center">
			<FeatureInterventionRadar />
		</LazyVisible>
	);
}
