"use client";

import * as React from "react";
import india from "@svg-maps/india";

import { cn } from "@/lib/utils";
import { parseSvgViewBox, type IndiaMapLocationId } from "@/lib/practice/visuals/india-map-regions";
import {
	INDIA_MAP_ATTRIBUTION,
	indiaMapOceanFill,
	indiaRegionPaint,
	normalizeIndiaMapStyle,
} from "@/lib/practice/visuals/india-map-paint";
import type { IndiaMapSpec } from "@/lib/practice/visuals/types";

/**
 * Administrative map of India from `@svg-maps/india` (CC BY 4.0).
 * `mapStyle` selects palette; `highlightedStates` uses lowercase ids (mh, rj, …).
 */
export function IndiaMap({ spec, className }: { spec: IndiaMapSpec; className?: string }): React.ReactElement {
	const mapStyle = normalizeIndiaMapStyle(spec.mapStyle);
	const highlighted = new Set(spec.highlightedStates ?? []);
	const vb = parseSvgViewBox(india.viewBox);
	const ocean = indiaMapOceanFill(mapStyle);

	const sorted = [...india.locations].sort((a, b) => {
		const ah = highlighted.has(a.id) ? 1 : 0;
		const bh = highlighted.has(b.id) ? 1 : 0;
		return ah - bh;
	});

	return (
		<div className={cn("flex w-full max-w-[440px] flex-col items-center gap-1", className)}>
			<svg
				viewBox={india.viewBox}
				className="h-auto w-full"
				preserveAspectRatio="xMidYMid meet"
				role="img"
				aria-hidden
			>
				<title>India map</title>
				<rect x={vb.vx} y={vb.vy} width={vb.vw} height={vb.vh} fill={ocean} />
				{sorted.map((loc) => {
					const paint = indiaRegionPaint(mapStyle, loc.id as IndiaMapLocationId, highlighted);
					return (
						<path
							key={loc.id}
							id={loc.id}
							d={loc.path}
							fill={paint.fill}
							stroke={paint.stroke}
							strokeWidth={paint.strokeWidth}
							vectorEffect="non-scaling-stroke"
						/>
					);
				})}
			</svg>
			<p className="text-muted-foreground max-w-[440px] text-center text-[10px] leading-snug">
				{INDIA_MAP_ATTRIBUTION}
			</p>
		</div>
	);
}
