"use client";

import * as React from "react";

import type { CoverageTimelinePoint } from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

const MS_PER_DAY = 86_400_000;

type SubjectCoverageTimelineProps = {
	points: CoverageTimelinePoint[];
	className?: string;
};

function buildLineAndArea(
	pts: { x: number; y: number }[],
	bottomY: number,
): { line: string; area: string } {
	if (pts.length === 0) {
		return { line: "", area: "" };
	}
	if (pts.length === 1) {
		const p = pts[0]!;
		return {
			line: `M ${p.x} ${p.y} L ${p.x} ${p.y}`,
			area: `M ${p.x} ${bottomY} L ${p.x} ${p.y} L ${p.x} ${bottomY} Z`,
		};
	}
	const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
	const last = pts[pts.length - 1]!;
	const first = pts[0]!;
	const area = `M ${first.x.toFixed(2)} ${bottomY.toFixed(2)} ${pts
		.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
		.join(" ")} L ${last.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
	return { line, area };
}

/**
 * Compact area chart for subject card: cumulative coverage vs time (local days).
 */
export function SubjectCoverageTimeline({ points, className }: SubjectCoverageTimelineProps) {
	const uid = React.useId().replace(/:/g, "");
	const gradId = `subj-cov-area-${uid}`;
	const strokeGradId = `subj-cov-stroke-${uid}`;

	const layout = React.useMemo(() => {
		const w = 320;
		const h = 80;
		const padL = 2;
		const padR = 2;
		const padT = 6;
		const padB = 14;
		const plotW = w - padL - padR;
		const plotH = h - padT - padB;
		const bottomY = padT + plotH;

		if (points.length < 2) {
			const midY = padT + plotH * 0.85;
			const line = `M ${padL} ${midY} L ${padL + plotW} ${midY}`;
			const area = `M ${padL} ${bottomY} L ${padL} ${midY} L ${padL + plotW} ${midY} L ${padL + plotW} ${bottomY} Z`;
			return { w, h, padL, padR, padT, padB, plotW, plotH, bottomY, line, area, dots: [] as { x: number; y: number }[] };
		}

		const tMin = points[0]!.atMs;
		const tMax = points[points.length - 1]!.atMs;
		const span = Math.max(MS_PER_DAY / 4, tMax - tMin);
		const toX = (atMs: number) => padL + ((atMs - tMin) / span) * plotW;
		const toY = (pct: number) => padT + plotH - (Math.min(100, Math.max(0, pct)) / 100) * plotH;

		const svgPts = points.map((p) => ({ x: toX(p.atMs), y: toY(p.pct) }));
		const { line, area } = buildLineAndArea(svgPts, bottomY);

		const lastPt = svgPts[svgPts.length - 1]!;
		const showEndDot = points[points.length - 1]!.pct > 0;
		const dots = showEndDot ? [lastPt] : [];

		return { w, h, padL, padR, padT, padB, plotW, plotH, bottomY, line, area, dots };
	}, [points]);

	const midY = layout.padT + layout.plotH * 0.5;

	return (
		<div className={cn("relative w-full", className)}>
			<svg
				viewBox={`0 0 ${layout.w} ${layout.h}`}
				className="h-[4.75rem] w-full overflow-visible text-primary"
				role="img"
				aria-hidden
			>
				<defs>
					<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
						<stop offset="55%" stopColor="currentColor" stopOpacity="0.06" />
						<stop offset="100%" stopColor="currentColor" stopOpacity="0" />
					</linearGradient>
					<linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
						<stop offset="100%" stopColor="currentColor" stopOpacity="1" />
					</linearGradient>
				</defs>

				{/* Baseline & mid reference */}
				<line
					x1={layout.padL}
					x2={layout.padL + layout.plotW}
					y1={layout.bottomY}
					y2={layout.bottomY}
					className="stroke-border/60"
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				/>
				<line
					x1={layout.padL}
					x2={layout.padL + layout.plotW}
					y1={midY}
					y2={midY}
					className="stroke-border/35"
					strokeWidth={1}
					strokeDasharray="3 5"
					vectorEffect="non-scaling-stroke"
				/>

				<path d={layout.area} fill={`url(#${gradId})`} className="text-primary" />
				<path
					d={layout.line}
					fill="none"
					stroke={`url(#${strokeGradId})`}
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					vectorEffect="non-scaling-stroke"
				/>
				{layout.dots.map((d, i) => (
					<circle
						key={i}
						cx={d.x}
						cy={d.y}
						r={3.5}
						className="fill-background stroke-primary"
						strokeWidth={2}
						vectorEffect="non-scaling-stroke"
					/>
				))}
			</svg>
			<p className="pointer-events-none absolute right-0 bottom-0 left-0 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				Coverage over time
			</p>
		</div>
	);
}
