"use client";

import * as React from "react";

import type { NumberLineSpec } from "@/lib/practice/visuals/types";

const SVG_WIDTH = 480;
const SVG_HEIGHT = 100;
const PADDING_X = 32;
const AXIS_Y = 60;
const POINT_RADIUS = 6;

/**
 * `number_line` renderer.
 *
 * Pure SVG; no chart library. Themed via `currentColor` plus Tailwind text
 * utilities so the line and tick marks adopt the surrounding text colour
 * and intervals/points use design-system primary/accent.
 */
export function NumberLine({ spec }: { spec: NumberLineSpec }): React.ReactElement {
	const range = spec.max - spec.min;
	if (range <= 0 || spec.tickStep <= 0) {
		return (
			<span className="text-muted-foreground text-sm">
				Invalid number-line range.
			</span>
		);
	}
	const innerWidth = SVG_WIDTH - 2 * PADDING_X;
	const xToScreen = (x: number): number => PADDING_X + ((x - spec.min) / range) * innerWidth;

	const ticks: number[] = [];
	{
		// Cap iterations defensively — bad spec numbers should not loop forever.
		const maxTicks = 200;
		let v = spec.min;
		while (v <= spec.max + 1e-9 && ticks.length < maxTicks) {
			ticks.push(v);
			v += spec.tickStep;
		}
	}

	return (
		<svg
			width={SVG_WIDTH}
			height={SVG_HEIGHT}
			viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
			className="text-foreground overflow-visible"
			role="img"
			aria-hidden="true"
		>
			<line
				x1={PADDING_X - 12}
				y1={AXIS_Y}
				x2={SVG_WIDTH - PADDING_X + 12}
				y2={AXIS_Y}
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="round"
				markerEnd="url(#nl-arrow)"
				markerStart="url(#nl-arrow-start)"
			/>
			<defs>
				<marker
					id="nl-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
				</marker>
				<marker
					id="nl-arrow-start"
					viewBox="0 0 10 10"
					refX="2"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto"
				>
					<path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" />
				</marker>
			</defs>

			{ticks.map((t, i) => (
				<g key={`tick-${i}`}>
					<line
						x1={xToScreen(t)}
						y1={AXIS_Y - 5}
						x2={xToScreen(t)}
						y2={AXIS_Y + 5}
						stroke="currentColor"
						strokeWidth={1}
					/>
					<text
						x={xToScreen(t)}
						y={AXIS_Y + 22}
						textAnchor="middle"
						fontSize={11}
						fill="currentColor"
					>
						{prettyTick(t)}
					</text>
				</g>
			))}

			<g className="text-primary">
				{spec.intervals.map((interval, i) => {
					const x1 = xToScreen(interval.from);
					const x2 = xToScreen(interval.to);
					return (
						<g key={`int-${i}`}>
							<line
								x1={x1}
								y1={AXIS_Y}
								x2={x2}
								y2={AXIS_Y}
								stroke="currentColor"
								strokeWidth={5}
								strokeOpacity={0.5}
								strokeLinecap="round"
							/>
							<circle
								cx={x1}
								cy={AXIS_Y}
								r={POINT_RADIUS}
								fill={interval.leftOpen ? "white" : "currentColor"}
								stroke="currentColor"
								strokeWidth={2}
							/>
							<circle
								cx={x2}
								cy={AXIS_Y}
								r={POINT_RADIUS}
								fill={interval.rightOpen ? "white" : "currentColor"}
								stroke="currentColor"
								strokeWidth={2}
							/>
							{interval.label ? (
								<text
									x={(x1 + x2) / 2}
									y={AXIS_Y - 14}
									textAnchor="middle"
									fontSize={11}
									fill="currentColor"
								>
									{interval.label}
								</text>
							) : null}
						</g>
					);
				})}
			</g>

			<g className="text-foreground">
				{spec.points.map((point, i) => (
					<g key={`pt-${i}`}>
						<circle
							cx={xToScreen(point.value)}
							cy={AXIS_Y}
							r={POINT_RADIUS}
							fill={point.openCircle ? "white" : "currentColor"}
							stroke="currentColor"
							strokeWidth={2}
						/>
						{point.label ? (
							<text
								x={xToScreen(point.value)}
								y={AXIS_Y - 14}
								textAnchor="middle"
								fontSize={11}
								fill="currentColor"
							>
								{point.label}
							</text>
						) : null}
					</g>
				))}
			</g>
		</svg>
	);
}

function prettyTick(t: number): string {
	if (Number.isInteger(t)) return t.toString();
	return Number(t.toFixed(2)).toString();
}
