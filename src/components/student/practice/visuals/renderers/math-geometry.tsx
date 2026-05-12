"use client";

import * as React from "react";

import { arcSweepRadians } from "@/lib/practice/visuals/math-geometry-arc";
import type { MathGeometrySpec } from "@/lib/practice/visuals/types";
import { SvgMixedTextLabel } from "../visual-math-text";

/**
 * `math_geometry` renderer.
 *
 * Draws primitives on a deterministic SVG viewport so we can support richer
 * annotations (vertex labels, angle arcs, segment tick marks, segment arrows)
 * without depending on library-specific text primitives.
 */
export function MathGeometry({ spec }: { spec: MathGeometrySpec }): React.ReactElement {
	const { view, primitives } = spec;
	const projector = React.useMemo(() => makeProjector(view), [view]);
	const markerId = React.useId();
	const gridStep = chooseGridStep(Math.max(view.xMax - view.xMin, view.yMax - view.yMin));

	return (
		<div className="w-full max-w-[480px]">
			<svg
				width={SVG_WIDTH}
				height={SVG_HEIGHT}
				viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
				className="text-foreground"
				role="img"
				aria-hidden="true"
			>
				<defs>
					<marker
						id={markerId}
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto"
					>
						<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
					</marker>
				</defs>

				{view.showGrid ? renderGrid(view, projector, gridStep) : null}
				{view.showAxes ? renderAxes(view, projector, gridStep) : null}
				{primitives.map((primitive, idx) =>
					renderPrimitive(primitive, idx, projector, markerId),
				)}
			</svg>
		</div>
	);
}

const SVG_WIDTH = 480;
const SVG_HEIGHT = 320;
const PADDING = 28;
const INNER_WIDTH = SVG_WIDTH - 2 * PADDING;
const INNER_HEIGHT = SVG_HEIGHT - 2 * PADDING;

type XY = { x: number; y: number };

type Projector = {
	toScreen: (point: XY) => XY;
	toX: (x: number) => number;
	toY: (y: number) => number;
};

function makeProjector(view: MathGeometrySpec["view"]): Projector {
	const xRange = Math.max(view.xMax - view.xMin, 1e-6);
	const yRange = Math.max(view.yMax - view.yMin, 1e-6);
	return {
		toScreen: (point) => ({
			x: PADDING + ((point.x - view.xMin) / xRange) * INNER_WIDTH,
			y: PADDING + ((view.yMax - point.y) / yRange) * INNER_HEIGHT,
		}),
		toX: (x) => PADDING + ((x - view.xMin) / xRange) * INNER_WIDTH,
		toY: (y) => PADDING + ((view.yMax - y) / yRange) * INNER_HEIGHT,
	};
}

function chooseGridStep(range: number): number {
	if (range <= 10) return 1;
	if (range <= 20) return 2;
	if (range <= 50) return 5;
	if (range <= 100) return 10;
	return 20;
}

function renderGrid(
	view: MathGeometrySpec["view"],
	projector: Projector,
	step: number,
): React.ReactElement {
	const lines: React.ReactElement[] = [];
	const xStart = Math.ceil(view.xMin / step) * step;
	for (let x = xStart; x <= view.xMax + 1e-9; x += step) {
		const p1 = projector.toScreen({ x, y: view.yMin });
		const p2 = projector.toScreen({ x, y: view.yMax });
		lines.push(
			<line
				key={`gx-${x.toFixed(3)}`}
				x1={p1.x}
				y1={p1.y}
				x2={p2.x}
				y2={p2.y}
				className="stroke-border"
				strokeOpacity={0.55}
				strokeWidth={1}
			/>,
		);
	}

	const yStart = Math.ceil(view.yMin / step) * step;
	for (let y = yStart; y <= view.yMax + 1e-9; y += step) {
		const p1 = projector.toScreen({ x: view.xMin, y });
		const p2 = projector.toScreen({ x: view.xMax, y });
		lines.push(
			<line
				key={`gy-${y.toFixed(3)}`}
				x1={p1.x}
				y1={p1.y}
				x2={p2.x}
				y2={p2.y}
				className="stroke-border"
				strokeOpacity={0.55}
				strokeWidth={1}
			/>,
		);
	}

	return <g aria-hidden="true">{lines}</g>;
}

function renderAxes(
	view: MathGeometrySpec["view"],
	projector: Projector,
	step: number,
): React.ReactElement {
	const xAxisVisible = view.yMin <= 0 && view.yMax >= 0;
	const yAxisVisible = view.xMin <= 0 && view.xMax >= 0;
	const xAxisY = projector.toY(0);
	const yAxisX = projector.toX(0);
	const ticks: React.ReactElement[] = [];

	if (xAxisVisible) {
		const start = Math.ceil(view.xMin / step) * step;
		for (let x = start; x <= view.xMax + 1e-9; x += step) {
			const sx = projector.toX(x);
			ticks.push(
				<g key={`xt-${x.toFixed(3)}`}>
					<line x1={sx} y1={xAxisY - 4} x2={sx} y2={xAxisY + 4} className="stroke-foreground" strokeWidth={1} />
					<text x={sx} y={xAxisY + 16} textAnchor="middle" fontSize={10} className="fill-foreground">
						{formatTick(x)}
					</text>
				</g>,
			);
		}
	}

	if (yAxisVisible) {
		const start = Math.ceil(view.yMin / step) * step;
		for (let y = start; y <= view.yMax + 1e-9; y += step) {
			const sy = projector.toY(y);
			ticks.push(
				<g key={`yt-${y.toFixed(3)}`}>
					<line x1={yAxisX - 4} y1={sy} x2={yAxisX + 4} y2={sy} className="stroke-foreground" strokeWidth={1} />
					<text x={yAxisX - 8} y={sy + 3} textAnchor="end" fontSize={10} className="fill-foreground">
						{formatTick(y)}
					</text>
				</g>,
			);
		}
	}

	return (
		<g aria-hidden="true">
			{yAxisVisible ? (
				<line
					x1={yAxisX}
					y1={PADDING}
					x2={yAxisX}
					y2={SVG_HEIGHT - PADDING}
					className="stroke-foreground"
					strokeWidth={1.5}
				/>
			) : null}
			{xAxisVisible ? (
				<line
					x1={PADDING}
					y1={xAxisY}
					x2={SVG_WIDTH - PADDING}
					y2={xAxisY}
					className="stroke-foreground"
					strokeWidth={1.5}
				/>
			) : null}
			{ticks}
		</g>
	);
}

function renderPrimitive(
	primitive: MathGeometrySpec["primitives"][number],
	idx: number,
	projector: Projector,
	markerId: string,
): React.ReactElement | null {
	switch (primitive.type) {
		case "point": {
			const point = projector.toScreen(primitive.at);
			return (
				<g key={`point-${idx}`}>
					<circle cx={point.x} cy={point.y} r={4} className="fill-indigo-500" />
					{renderLabel(
						primitive.label,
						labelAtCardinal(primitive.at, primitive.labelPosition ?? "n"),
						projector,
						`point-label-${idx}`,
					)}
				</g>
			);
		}
		case "segment":
			return renderSegment(primitive, idx, projector, markerId);
		case "polygon":
			return renderPolygon(primitive, idx, projector);
		case "vector": {
			const from = projector.toScreen(primitive.from);
			const to = projector.toScreen(primitive.to);
			return (
				<g key={`vector-${idx}`}>
					<line
						x1={from.x}
						y1={from.y}
						x2={to.x}
						y2={to.y}
						className="stroke-red-500"
						strokeWidth={2}
						markerEnd={`url(#${markerId})`}
					/>
					{renderLabel(
						primitive.label,
						interpolate(primitive.from, primitive.to, 0.82),
						projector,
						`vector-label-${idx}`,
					)}
				</g>
			);
		}
		case "angle_marker":
			return renderAngleMarker(primitive, idx, projector);
		case "circle": {
			const center = projector.toScreen(primitive.center);
			const edge = projector.toScreen({
				x: primitive.center.x + primitive.radius,
				y: primitive.center.y,
			});
			const radiusPx = Math.abs(edge.x - center.x);
			return (
				<g key={`circle-${idx}`}>
					<circle
						cx={center.x}
						cy={center.y}
						r={radiusPx}
						className="fill-transparent stroke-blue-500"
						strokeWidth={2}
					/>
					{renderLabel(
						primitive.label,
						{ x: primitive.center.x + primitive.radius + 0.4, y: primitive.center.y + 0.4 },
						projector,
						`circle-label-${idx}`,
					)}
				</g>
			);
		}
		case "arc":
			return renderArc(primitive, idx, projector);
		default:
			return null;
	}
}

function renderSegment(
	primitive: Extract<MathGeometrySpec["primitives"][number], { type: "segment" }>,
	idx: number,
	projector: Projector,
	markerId: string,
): React.ReactElement {
	const from = projector.toScreen(primitive.from);
	const to = projector.toScreen(primitive.to);
	const tickMarks = primitive.tickMarks ?? 0;
	const ticks: React.ReactElement[] = [];

	if (tickMarks > 0) {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.hypot(dx, dy) || 1;
		const ux = dx / len;
		const uy = dy / len;
		const px = -uy;
		const py = ux;
		for (let i = 0; i < tickMarks; i++) {
			const offset = (i - (tickMarks - 1) / 2) * 8;
			const cx = (from.x + to.x) / 2 + ux * offset;
			const cy = (from.y + to.y) / 2 + uy * offset;
			ticks.push(
				<line
					key={`segment-tick-${idx}-${i}`}
					x1={cx - px * 5}
					y1={cy - py * 5}
					x2={cx + px * 5}
					y2={cy + py * 5}
					className="stroke-foreground"
					strokeWidth={1.4}
				/>,
			);
		}
	}

	return (
		<g key={`segment-${idx}`}>
			<line
				x1={from.x}
				y1={from.y}
				x2={to.x}
				y2={to.y}
				className="stroke-foreground"
				strokeWidth={2}
				strokeDasharray={primitive.dashed ? "6 4" : undefined}
				markerEnd={primitive.arrowEnd ? `url(#${markerId})` : undefined}
			/>
			{ticks}
			{renderLabel(
				primitive.label,
				midpoint(primitive.from, primitive.to),
				projector,
				`segment-label-${idx}`,
			)}
		</g>
	);
}

function renderPolygon(
	primitive: Extract<MathGeometrySpec["primitives"][number], { type: "polygon" }>,
	idx: number,
	projector: Projector,
): React.ReactElement {
	const points = primitive.vertices.map((v) => projector.toScreen(v));
	const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
	const vertexLabels = primitive.vertexLabels ?? [];
	return (
		<g key={`polygon-${idx}`}>
			<polygon
				points={polygonPoints}
				className={primitive.filled ? "fill-green-500/20 stroke-green-600" : "fill-transparent stroke-green-600"}
				strokeWidth={2}
			/>
			{renderLabel(primitive.label, centroid(primitive.vertices), projector, `polygon-label-${idx}`)}
			{vertexLabels.map((label, i) =>
				renderLabel(
					label,
					offsetByDirection(
						primitive.vertices[i] ?? primitive.vertices[0]!,
						"ne",
						0.28,
					),
					projector,
					`polygon-vertex-label-${idx}-${i}`,
				),
			)}
		</g>
	);
}

function renderAngleMarker(
	primitive: Extract<MathGeometrySpec["primitives"][number], { type: "angle_marker" }>,
	idx: number,
	projector: Projector,
): React.ReactElement {
	const v = primitive.vertex;
	const a = primitive.fromRayPoint;
	const b = primitive.toRayPoint;
	const uv1 = normalize({ x: a.x - v.x, y: a.y - v.y });
	const uv2 = normalize({ x: b.x - v.x, y: b.y - v.y });
	const angle = angleBetween(uv1, uv2);
	const radius = Math.max(Math.min(distance(v, a), distance(v, b)) * 0.25, 0.45);

	const vertex = projector.toScreen(v);
	const aScreen = projector.toScreen(a);
	const bScreen = projector.toScreen(b);
	const isRightAngle = Math.abs(angle - Math.PI / 2) < 0.09;

	const startDeg = (Math.atan2(uv1.y, uv1.x) * 180) / Math.PI;
	const endDeg = (Math.atan2(uv2.y, uv2.x) * 180) / Math.PI;
	const arcPts = arcPoints(v, radius, startDeg, endDeg, true);
	const arcMid = arcPts[Math.floor(arcPts.length / 2)] ?? v;

	return (
		<g key={`angle-${idx}`}>
			<line x1={vertex.x} y1={vertex.y} x2={aScreen.x} y2={aScreen.y} className="stroke-foreground" strokeWidth={2} />
			<line x1={vertex.x} y1={vertex.y} x2={bScreen.x} y2={bScreen.y} className="stroke-foreground" strokeWidth={2} />
			{isRightAngle ? (
				renderRightAngleSquare(v, uv1, uv2, Math.min(radius * 0.75, 0.85), projector, idx)
			) : (
				<path d={pointsToPath(arcPts, projector)} className="fill-transparent stroke-foreground" strokeWidth={2} />
			)}
			{renderLabel(
				primitive.label,
				{
					x: arcMid.x + (uv1.x + uv2.x) * 0.2,
					y: arcMid.y + (uv1.y + uv2.y) * 0.2,
				},
				projector,
				`angle-label-${idx}`,
			)}
		</g>
	);
}

function renderRightAngleSquare(
	vertex: XY,
	uv1: XY,
	uv2: XY,
	size: number,
	projector: Projector,
	idx: number,
): React.ReactElement {
	const p1 = { x: vertex.x + uv1.x * size, y: vertex.y + uv1.y * size };
	const p2 = { x: p1.x + uv2.x * size, y: p1.y + uv2.y * size };
	const p3 = { x: vertex.x + uv2.x * size, y: vertex.y + uv2.y * size };
	const s1 = projector.toScreen(p1);
	const s2 = projector.toScreen(p2);
	const s3 = projector.toScreen(p3);
	return (
		<polyline
			key={`right-angle-${idx}`}
			points={`${s1.x},${s1.y} ${s2.x},${s2.y} ${s3.x},${s3.y}`}
			className="fill-transparent stroke-foreground"
			strokeWidth={2}
		/>
	);
}

function renderArc(
	primitive: Extract<MathGeometrySpec["primitives"][number], { type: "arc" }>,
	idx: number,
	projector: Projector,
): React.ReactElement {
	const radius =
		primitive.radiusFraction != null
			? primitive.radius * primitive.radiusFraction
			: primitive.radius;
	const minorArc = primitive.minorArc ?? true;
	const points = arcPoints(
		primitive.center,
		radius,
		primitive.startAngleDeg,
		primitive.endAngleDeg,
		minorArc,
	);
	const sweep = arcSweepRadians(
		primitive.startAngleDeg,
		primitive.endAngleDeg,
		minorArc,
	);
	const mid = points[Math.floor(points.length / 2)] ?? primitive.center;
	const midAngle = (primitive.startAngleDeg * Math.PI) / 180 + sweep / 2;
	return (
		<g key={`arc-${idx}`}>
			<path
				d={pointsToPath(points, projector)}
				className="fill-transparent stroke-foreground"
				strokeWidth={2}
				strokeDasharray={primitive.dashed ? "6 4" : undefined}
			/>
			{renderLabel(
				primitive.label,
				{
					x: mid.x + Math.cos(midAngle) * 0.35,
					y: mid.y + Math.sin(midAngle) * 0.35,
				},
				projector,
				`arc-label-${idx}`,
			)}
		</g>
	);
}

function renderLabel(
	label: string | null,
	at: XY,
	projector: Projector,
	key: string,
): React.ReactElement | null {
	if (!label) return null;
	const point = projector.toScreen(at);
	return (
		<SvgMixedTextLabel key={key} x={point.x} y={point.y} text={label} fontSize={12} textAnchor="middle" />
	);
}

function labelAtCardinal(
	point: XY,
	position: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
): XY {
	return offsetByDirection(point, position, 0.35);
}

function offsetByDirection(
	point: XY,
	position: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
	delta: number,
): XY {
	switch (position) {
		case "n":
			return { x: point.x, y: point.y + delta };
		case "s":
			return { x: point.x, y: point.y - delta };
		case "e":
			return { x: point.x + delta, y: point.y };
		case "w":
			return { x: point.x - delta, y: point.y };
		case "ne":
			return { x: point.x + delta, y: point.y + delta };
		case "nw":
			return { x: point.x - delta, y: point.y + delta };
		case "se":
			return { x: point.x + delta, y: point.y - delta };
		case "sw":
			return { x: point.x - delta, y: point.y - delta };
		default:
			return { x: point.x, y: point.y + delta };
	}
}

function midpoint(a: XY, b: XY): XY {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function interpolate(a: XY, b: XY, t: number): XY {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function centroid(vertices: XY[]): XY {
	const total = vertices.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }), {
		x: 0,
		y: 0,
	});
	return { x: total.x / vertices.length, y: total.y / vertices.length };
}

function arcPoints(
	center: XY,
	radius: number,
	startAngleDeg: number,
	endAngleDeg: number,
	minorArc: boolean,
): XY[] {
	const start = (startAngleDeg * Math.PI) / 180;
	const sweep = arcSweepRadians(startAngleDeg, endAngleDeg, minorArc);
	const samples = 28;
	const points: XY[] = [];
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const angle = start + sweep * t;
		points.push({
			x: center.x + radius * Math.cos(angle),
			y: center.y + radius * Math.sin(angle),
		});
	}
	return points;
}

function pointsToPath(points: XY[], projector: Projector): string {
	if (points.length === 0) return "";
	return points
		.map((point, i) => {
			const p = projector.toScreen(point);
			return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
		})
		.join(" ");
}

function normalize(point: XY): XY {
	const len = Math.hypot(point.x, point.y) || 1;
	return { x: point.x / len, y: point.y / len };
}

function distance(a: XY, b: XY): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a: XY, b: XY): number {
	const dot = a.x * b.x + a.y * b.y;
	const mag = (Math.hypot(a.x, a.y) || 1) * (Math.hypot(b.x, b.y) || 1);
	const ratio = Math.max(-1, Math.min(1, dot / mag));
	return Math.acos(ratio);
}

function formatTick(n: number): string {
	if (Math.abs(n) < 1e-9) return "0";
	if (Number.isInteger(n)) return String(n);
	return Number(n.toFixed(2)).toString();
}
