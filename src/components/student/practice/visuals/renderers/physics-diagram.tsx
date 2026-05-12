"use client";

import * as React from "react";

import type { PhysicsDiagramSpec } from "@/lib/practice/visuals/types";
import { SvgMixedTextLabel } from "../visual-math-text";

/**
 * `physics_diagram` renderer.
 *
 * Three sub-kinds:
 *   - `free_body`  — body label at origin, force vectors drawn from origin
 *                    at the spec'd magnitudes/angles (auto-scaled).
 *   - `ray_optics` — principal axis horizontal, object as upright arrow,
 *                    image as dashed arrow, lens(es) as vertical lines
 *                    with focal-point markers.
 *   - `circuit`    — nodes + components rendered as raw SVG; battery,
 *                    resistor (zigzag), bulb, switch, ammeter, voltmeter,
 *                    plain wires.
 *
 * All three sub-kinds are pure SVG so the bundle stays small and there
 * is no client-only library beyond what physics needs (no Mafs here —
 * we keep this renderer independent so circuits do not pay the Mafs cost
 * even when shipped together).
 */
export function PhysicsDiagram({
	spec,
}: {
	spec: PhysicsDiagramSpec;
}): React.ReactElement {
	switch (spec.subKind) {
		case "free_body":
			return <FreeBody spec={spec} />;
		case "ray_optics":
			return <RayOptics spec={spec} />;
		case "circuit":
			return <Circuit spec={spec} />;
	}
}

// ───────────────────────────────────────────────────────────────────────
// Free body diagram
// ───────────────────────────────────────────────────────────────────────

function FreeBody({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "free_body" }>;
}): React.ReactElement {
	const SVG_SIZE = 320;
	const CENTER = SVG_SIZE / 2;
	const maxMag = Math.max(...spec.forces.map((f) => f.magnitude), 1);
	const arrowMaxPx = 110;
	const showAxisLegend = spec.axisLegend ?? true;
	const surfaceHatched = spec.surfaceHatched ?? false;
	const inclineText =
		spec.inclineLabel != null && spec.inclineLabel.trim().length > 0
			? spec.inclineLabel.trim()
			: spec.inclineDeg != null
				? `${pretty(spec.inclineDeg)}°`
				: null;
	const inclineStart = { x: 20, y: SVG_SIZE - 20 };
	const inclineEnd = spec.inclineDeg != null
		? {
				x: SVG_SIZE - 20,
				y:
					SVG_SIZE -
					20 -
					Math.tan((spec.inclineDeg * Math.PI) / 180) * (SVG_SIZE - 40),
			}
		: null;

	return (
		<svg
			width={SVG_SIZE}
			height={SVG_SIZE}
			viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
			className="text-foreground"
			role="img"
			aria-hidden="true"
		>
			<defs>
				<marker
					id="fb-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
				</marker>
			</defs>

			{inclineEnd != null ? (
				<g>
					<line
						x1={inclineStart.x}
						y1={inclineStart.y}
						x2={inclineEnd.x}
						y2={inclineEnd.y}
						stroke="currentColor"
						strokeWidth={1.5}
						strokeOpacity={0.7}
					/>
					{surfaceHatched
						? renderInclineHatching(inclineStart, inclineEnd)
						: null}
					{spec.inclineDeg != null && inclineText != null
						? renderInclineAngle(inclineStart, spec.inclineDeg, inclineText)
						: null}
				</g>
			) : null}

			<rect
				x={CENTER - 22}
				y={CENTER - 18}
				width={44}
				height={36}
				rx={3}
				className="fill-card stroke-foreground"
				strokeWidth={1.5}
			/>
			<SvgMixedTextLabel
				x={CENTER}
				y={CENTER + 5}
				text={truncate(spec.bodyLabel, 18)}
				fontSize={11}
				textAnchor="middle"
			/>

			{showAxisLegend ? (
				<g>
					<line
						x1={SVG_SIZE - 82}
						y1={38}
						x2={SVG_SIZE - 48}
						y2={38}
						stroke="currentColor"
						strokeWidth={1.5}
						markerEnd="url(#fb-arrow)"
					/>
					<line
						x1={SVG_SIZE - 82}
						y1={38}
						x2={SVG_SIZE - 82}
						y2={8}
						stroke="currentColor"
						strokeWidth={1.5}
						markerEnd="url(#fb-arrow)"
					/>
					<text
						x={SVG_SIZE - 42}
						y={41}
						fontSize={10}
						className="fill-foreground"
					>
						+x
					</text>
					<text
						x={SVG_SIZE - 88}
						y={8}
						fontSize={10}
						className="fill-foreground"
					>
						+y
					</text>
				</g>
			) : null}

			{spec.forces.map((force, i) => {
				const lengthPx = (force.magnitude / maxMag) * arrowMaxPx;
				const rad = (force.angleDeg * Math.PI) / 180;
				const tipX = CENTER + Math.cos(rad) * lengthPx;
				const tipY = CENTER - Math.sin(rad) * lengthPx;
				const labelX = CENTER + Math.cos(rad) * (lengthPx + 16);
				const labelY = CENTER - Math.sin(rad) * (lengthPx + 16);
				const label = formatForceLabel(force);
				return (
					<g key={`f-${i}`}>
						<line
							x1={CENTER}
							y1={CENTER}
							x2={tipX}
							y2={tipY}
							stroke="currentColor"
							strokeWidth={2}
							markerEnd="url(#fb-arrow)"
						/>
						{force.componentArrows ? (
							<>
								<line
									x1={CENTER}
									y1={CENTER}
									x2={tipX}
									y2={CENTER}
									stroke="currentColor"
									strokeWidth={1}
									strokeDasharray="4 3"
									strokeOpacity={0.6}
								/>
								<line
									x1={tipX}
									y1={CENTER}
									x2={tipX}
									y2={tipY}
									stroke="currentColor"
									strokeWidth={1}
									strokeDasharray="4 3"
									strokeOpacity={0.6}
								/>
							</>
						) : null}
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={11}
							textAnchor="middle"
						/>
					</g>
				);
			})}
		</svg>
	);
}

// ───────────────────────────────────────────────────────────────────────
// Ray optics
// ───────────────────────────────────────────────────────────────────────

function RayOptics({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>;
}): React.ReactElement {
	const SVG_W = 480;
	const SVG_H = 240;
	const PADDING = 24;
	const innerW = SVG_W - 2 * PADDING;
	const innerH = SVG_H - 2 * PADDING;
	const yAxis = SVG_H / 2;
	const tickStep = spec.axisTickStep ?? Math.max(1, Math.round((spec.axisMax - spec.axisMin) / 10));
	const majorTickStep = spec.axisMajorTickStep ?? tickStep * 2;
	const axisUnit = spec.axisUnit?.trim() ?? "";

	const xRange = spec.axisMax - spec.axisMin;
	if (xRange <= 0) {
		return (
			<span className="text-muted-foreground text-sm">Invalid ray-optics axis range.</span>
		);
	}
	const xToScreen = (x: number): number => PADDING + ((x - spec.axisMin) / xRange) * innerW;
	const maxAbsHeight = Math.max(
		...spec.objects.map((o) => Math.abs(o.height)),
		1,
	);
	const yScale = (innerH / 2 - 12) / maxAbsHeight;
	const heightToScreen = (h: number): number => -(h * yScale);
	const objectRef = spec.objects.find((o) => o.kind === "object") ?? spec.objects[0] ?? null;
	const imageRef = spec.objects.find((o) => o.kind === "image") ?? null;
	const lensRef = spec.lenses[0] ?? null;
	const axisTicks = buildAxisTicks(spec.axisMin, spec.axisMax, tickStep);

	return (
		<svg
			width={SVG_W}
			height={SVG_H}
			viewBox={`0 0 ${SVG_W} ${SVG_H}`}
			className="text-foreground"
			role="img"
			aria-hidden="true"
		>
			<defs>
				<marker
					id="ray-arrow"
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

			{axisTicks.map((tick) => {
				const sx = xToScreen(tick);
				const major = isMajorTick(tick, majorTickStep);
				return (
					<g key={`axis-tick-${tick}`}>
						<line
							x1={sx}
							y1={yAxis - (major ? 7 : 4)}
							x2={sx}
							y2={yAxis + (major ? 7 : 4)}
							stroke="currentColor"
							strokeWidth={1}
						/>
						{major ? (
							<text
								x={sx}
								y={yAxis + 18}
								textAnchor="middle"
								fontSize={9}
								className="fill-foreground"
							>
								{pretty(tick)}
							</text>
						) : null}
					</g>
				);
			})}

			<line
				x1={PADDING}
				y1={yAxis}
				x2={SVG_W - PADDING}
				y2={yAxis}
				stroke="currentColor"
				strokeWidth={1.5}
				strokeOpacity={0.7}
				markerEnd="url(#ray-arrow)"
			/>
			{textIf(
				axisUnit.length > 0,
				<SvgMixedTextLabel
					x={SVG_W - PADDING - 4}
					y={yAxis - 8}
					text={`x (${axisUnit})`}
					fontSize={10}
					textAnchor="end"
				/>,
			)}

			{spec.lenses.map((lens, i) => {
				const x = xToScreen(lens.x);
				const fLeft = xToScreen(lens.x - lens.focalLength);
				const fRight = xToScreen(lens.x + lens.focalLength);
				const lensLabel = lens.label ?? lensTypeLabel(lens.type);
				const fLabel = axisUnit.length > 0
					? `f=${pretty(lens.focalLength)} ${axisUnit}`
					: `f=${pretty(lens.focalLength)}`;
				return (
					<g key={`l-${i}`}>
						<line
							x1={x}
							y1={PADDING}
							x2={x}
							y2={SVG_H - PADDING}
							stroke="currentColor"
							strokeWidth={2}
						/>
						<circle cx={fLeft} cy={yAxis} r={3} className="fill-foreground" />
						<circle cx={fRight} cy={yAxis} r={3} className="fill-foreground" />
						<text
							x={fLeft}
							y={yAxis + 30}
							textAnchor="middle"
							fontSize={10}
							className="fill-foreground"
						>
							F
						</text>
						<text
							x={fRight}
							y={yAxis + 30}
							textAnchor="middle"
							fontSize={10}
							className="fill-foreground"
						>
							F
						</text>
						<SvgMixedTextLabel
							x={x}
							y={PADDING - 6}
							text={lensLabel}
							fontSize={10}
							textAnchor="middle"
						/>
						<SvgMixedTextLabel
							x={fRight}
							y={yAxis - 8}
							text={fLabel}
							fontSize={9}
							textAnchor="middle"
						/>
					</g>
				);
			})}

			{spec.objects.map((obj, i) => {
				const x = xToScreen(obj.x);
				const tipY = yAxis + heightToScreen(obj.height);
				const posLabel = objectPositionLabel(obj, axisUnit);
				const kindLabel = obj.label ?? (obj.kind === "object" ? "O" : "I");
				return (
					<g key={`o-${i}`}>
						<line
							x1={x}
							y1={yAxis}
							x2={x}
							y2={tipY}
							stroke="currentColor"
							strokeWidth={2}
							strokeDasharray={obj.dashed ? "4,3" : undefined}
							markerEnd="url(#ray-arrow)"
						/>
						<line
							x1={x}
							y1={tipY}
							x2={x}
							y2={yAxis}
							stroke="currentColor"
							strokeWidth={1}
							strokeDasharray="3,3"
							strokeOpacity={0.6}
						/>
						<SvgMixedTextLabel
							x={x + 8}
							y={tipY + (obj.height >= 0 ? -4 : 12)}
							text={kindLabel}
							fontSize={10}
							textAnchor="start"
						/>
						<SvgMixedTextLabel
							x={x}
							y={yAxis + 14}
							text={posLabel}
							fontSize={9}
							textAnchor="middle"
						/>
					</g>
				);
			})}

			{spec.drawRays && objectRef != null && lensRef != null ? (
				renderRayBundle({
					objectRef,
					imageRef,
					lensRef,
					xToScreen,
					heightToScreen,
					yAxis,
				})
			) : null}
		</svg>
	);
}

// ───────────────────────────────────────────────────────────────────────
// Circuit (raw SVG)
// ───────────────────────────────────────────────────────────────────────

function Circuit({
	spec,
}: {
	spec: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>;
}): React.ReactElement {
	const SVG_W = 480;
	const SVG_H = 320;
	const PADDING = 32;
	const nodeMap = new Map(spec.nodes.map((n) => [n.id, n] as const));
	const xs = spec.nodes.map((n) => n.x);
	const ys = spec.nodes.map((n) => n.y);
	const xMin = Math.min(...xs);
	const xMax = Math.max(...xs);
	const yMin = Math.min(...ys);
	const yMax = Math.max(...ys);
	const xRange = Math.max(xMax - xMin, 1);
	const yRange = Math.max(yMax - yMin, 1);
	const innerW = SVG_W - 2 * PADDING;
	const innerH = SVG_H - 2 * PADDING;
	const currentArrowMarkerId = React.useId();
	const project = (x: number, y: number): { x: number; y: number } => ({
		x: PADDING + ((x - xMin) / xRange) * innerW,
		y: PADDING + ((y - yMin) / yRange) * innerH,
	});

	return (
		<svg
			width={SVG_W}
			height={SVG_H}
			viewBox={`0 0 ${SVG_W} ${SVG_H}`}
			className="text-foreground"
			role="img"
			aria-hidden="true"
		>
			<defs>
				<marker
					id={currentArrowMarkerId}
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="5"
					markerHeight="5"
					orient="auto"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
				</marker>
			</defs>

			{spec.components.map((comp, i) => {
				const fromNode = nodeMap.get(comp.from);
				const toNode = nodeMap.get(comp.to);
				if (!fromNode || !toNode) return null;
				const a = project(fromNode.x, fromNode.y);
				const b = project(toNode.x, toNode.y);
				return (
					<CircuitComponent
						key={`comp-${i}`}
						component={comp}
						a={a}
						b={b}
						currentArrowMarkerId={currentArrowMarkerId}
					/>
				);
			})}

			{spec.nodes.map((n) => {
				const p = project(n.x, n.y);
				return (
					<circle
						key={`n-${n.id}`}
						cx={p.x}
						cy={p.y}
						r={3}
						className="fill-foreground"
					/>
				);
			})}
		</svg>
	);
}

function CircuitComponent({
	component,
	a,
	b,
	currentArrowMarkerId,
}: {
	component: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>["components"][number];
	a: { x: number; y: number };
	b: { x: number; y: number };
	currentArrowMarkerId: string;
}): React.ReactElement {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const length = Math.max(Math.hypot(dx, dy), 1);
	const ux = dx / length;
	const uy = dy / length;
	const px = -uy;
	const py = ux;
	const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	const glyphHalf = 18;
	const glyphStart = { x: mid.x - ux * glyphHalf, y: mid.y - uy * glyphHalf };
	const glyphEnd = { x: mid.x + ux * glyphHalf, y: mid.y + uy * glyphHalf };

	const wireBefore = (
		<line
			x1={a.x}
			y1={a.y}
			x2={glyphStart.x}
			y2={glyphStart.y}
			stroke="currentColor"
			strokeWidth={1.5}
		/>
	);
	const wireAfter = (
		<line
			x1={glyphEnd.x}
			y1={glyphEnd.y}
			x2={b.x}
			y2={b.y}
			stroke="currentColor"
			strokeWidth={1.5}
		/>
	);
	const label = componentLabel(component);
	const showCurrentArrow = component.currentArrow ?? false;
	const labelX = mid.x + px * 18;
	const labelY = mid.y + py * 18;

	switch (component.type) {
		case "wire":
			return (
				<g>
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke="currentColor"
						strokeWidth={1.5}
					/>
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
		case "battery": {
			const longLineHalf = 8;
			const shortLineHalf = 5;
			const longX = mid.x - ux * 4;
			const longY = mid.y - uy * 4;
			const shortX = mid.x + ux * 4;
			const shortY = mid.y + uy * 4;
			return (
				<g>
					{wireBefore}
					{wireAfter}
					<line
						x1={longX + px * longLineHalf}
						y1={longY + py * longLineHalf}
						x2={longX - px * longLineHalf}
						y2={longY - py * longLineHalf}
						stroke="currentColor"
						strokeWidth={2}
					/>
					<line
						x1={shortX + px * shortLineHalf}
						y1={shortY + py * shortLineHalf}
						x2={shortX - px * shortLineHalf}
						y2={shortY - py * shortLineHalf}
						stroke="currentColor"
						strokeWidth={2}
					/>
					{component.polarityMarks ?? true ? (
						<>
							<text
								x={longX + px * (longLineHalf + 8)}
								y={longY + py * (longLineHalf + 8)}
								fontSize={10}
								textAnchor="middle"
								className="fill-foreground"
							>
								+
							</text>
							<text
								x={shortX + px * (shortLineHalf + 8)}
								y={shortY + py * (shortLineHalf + 8)}
								fontSize={10}
								textAnchor="middle"
								className="fill-foreground"
							>
								-
							</text>
						</>
					) : null}
					{label ? (
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={10}
							textAnchor="middle"
						/>
					) : null}
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
		}
		case "resistor": {
			const teeth = 4;
			const teethSpacing = (2 * glyphHalf) / teeth;
			const points: string[] = [];
			points.push(`${glyphStart.x},${glyphStart.y}`);
			for (let i = 0; i < teeth; i++) {
				const tx = glyphStart.x + ux * teethSpacing * (i + 0.5);
				const ty = glyphStart.y + uy * teethSpacing * (i + 0.5);
				const off = i % 2 === 0 ? 5 : -5;
				points.push(`${tx + px * off},${ty + py * off}`);
			}
			points.push(`${glyphEnd.x},${glyphEnd.y}`);
			return (
				<g>
					{wireBefore}
					{wireAfter}
					<polyline
						points={points.join(" ")}
						fill="none"
						stroke="currentColor"
						strokeWidth={1.5}
					/>
					{label ? (
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={10}
							textAnchor="middle"
						/>
					) : null}
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
		}
		case "bulb":
			return (
				<g>
					{wireBefore}
					{wireAfter}
					<circle
						cx={mid.x}
						cy={mid.y}
						r={glyphHalf - 4}
						className="fill-card stroke-foreground"
						strokeWidth={1.5}
					/>
					<line
						x1={mid.x - 7}
						y1={mid.y - 7}
						x2={mid.x + 7}
						y2={mid.y + 7}
						stroke="currentColor"
						strokeWidth={1.2}
					/>
					<line
						x1={mid.x + 7}
						y1={mid.y - 7}
						x2={mid.x - 7}
						y2={mid.y + 7}
						stroke="currentColor"
						strokeWidth={1.2}
					/>
					{label ? (
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={10}
							textAnchor="middle"
						/>
					) : null}
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
		case "switch":
			return (
				<g>
					{wireBefore}
					{wireAfter}
					<circle
						cx={glyphStart.x}
						cy={glyphStart.y}
						r={2}
						className="fill-foreground"
					/>
					<circle cx={glyphEnd.x} cy={glyphEnd.y} r={2} className="fill-foreground" />
					<line
						x1={glyphStart.x}
						y1={glyphStart.y}
						x2={component.closed ? glyphEnd.x : glyphStart.x + ux * 30 + px * -10}
						y2={component.closed ? glyphEnd.y : glyphStart.y + uy * 30 + py * -10}
						stroke="currentColor"
						strokeWidth={1.5}
					/>
					{label ? (
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={10}
							textAnchor="middle"
						/>
					) : null}
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
		case "ammeter":
		case "voltmeter":
			return (
				<g>
					{wireBefore}
					{wireAfter}
					<circle
						cx={mid.x}
						cy={mid.y}
						r={glyphHalf - 4}
						className="fill-card stroke-foreground"
						strokeWidth={1.5}
					/>
					<text
						x={mid.x}
						y={mid.y + 4}
						textAnchor="middle"
						fontSize={11}
						fontWeight={600}
						className="fill-foreground"
					>
						{component.type === "ammeter" ? "A" : "V"}
					</text>
					{label ? (
						<SvgMixedTextLabel
							x={labelX}
							y={labelY}
							text={label}
							fontSize={10}
							textAnchor="middle"
						/>
					) : null}
					{showCurrentArrow ? (
						<line
							x1={mid.x - ux * 10}
							y1={mid.y - uy * 10}
							x2={mid.x + ux * 10}
							y2={mid.y + uy * 10}
							stroke="currentColor"
							strokeWidth={1.3}
							markerEnd={`url(#${currentArrowMarkerId})`}
						/>
					) : null}
				</g>
			);
	}
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}

function formatForceLabel(
	force: Extract<PhysicsDiagramSpec, { subKind: "free_body" }>["forces"][number],
): string {
	if (!force.showMagnitude) return force.name;
	const unit = force.unit?.trim() ? ` ${force.unit.trim()}` : "";
	return `${force.name} = ${pretty(force.magnitude)}${unit}`;
}

function renderInclineHatching(start: { x: number; y: number }, end: { x: number; y: number }) {
	const lines: React.ReactElement[] = [];
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const len = Math.max(Math.hypot(dx, dy), 1);
	const ux = dx / len;
	const uy = dy / len;
	let nx = -uy;
	let ny = ux;
	if (ny < 0) {
		nx = -nx;
		ny = -ny;
	}
	for (let i = 1; i <= 18; i++) {
		const t = i / 19;
		const px = start.x + dx * t;
		const py = start.y + dy * t;
		lines.push(
			<line
				key={`hatch-${i}`}
				x1={px}
				y1={py}
				x2={px + nx * 8}
				y2={py + ny * 8}
				stroke="currentColor"
				strokeWidth={1}
				strokeOpacity={0.55}
			/>,
		);
	}
	return <g>{lines}</g>;
}

function renderInclineAngle(start: { x: number; y: number }, inclineDeg: number, label: string) {
	const r = 24;
	const theta = (inclineDeg * Math.PI) / 180;
	const sx = start.x + r;
	const sy = start.y;
	const ex = start.x + r * Math.cos(theta);
	const ey = start.y - r * Math.sin(theta);
	return (
		<g>
			<path
				d={`M ${sx} ${sy} A ${r} ${r} 0 0 0 ${ex} ${ey}`}
				stroke="currentColor"
				strokeWidth={1.3}
				fill="none"
				strokeOpacity={0.7}
			/>
			<SvgMixedTextLabel
				x={start.x + r * 0.72}
				y={start.y - 8}
				text={label}
				fontSize={10}
				textAnchor="start"
			/>
		</g>
	);
}

function buildAxisTicks(min: number, max: number, step: number): number[] {
	const ticks: number[] = [];
	const start = Math.ceil(min / step) * step;
	for (let x = start; x <= max + 1e-9; x += step) {
		ticks.push(Number(x.toFixed(6)));
	}
	return ticks;
}

function isMajorTick(value: number, majorStep: number): boolean {
	const r = Math.abs(value % majorStep);
	return r < 1e-6 || Math.abs(r - majorStep) < 1e-6;
}

function lensTypeLabel(
	type: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>["lenses"][number]["type"],
): string {
	switch (type) {
		case "convex_lens":
			return "Convex lens";
		case "concave_lens":
			return "Concave lens";
		case "convex_mirror":
			return "Convex mirror";
		case "concave_mirror":
			return "Concave mirror";
		default:
			return type;
	}
}

function objectPositionLabel(
	obj: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>["objects"][number],
	axisUnit: string,
): string {
	const symbol = obj.kind === "object" ? "u" : "v";
	return axisUnit.length > 0
		? `${symbol}=${pretty(obj.x)} ${axisUnit}`
		: `${symbol}=${pretty(obj.x)}`;
}

function renderRayBundle(args: {
	objectRef: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>["objects"][number];
	imageRef: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>["objects"][number] | null;
	lensRef: Extract<PhysicsDiagramSpec, { subKind: "ray_optics" }>["lenses"][number];
	xToScreen: (x: number) => number;
	heightToScreen: (h: number) => number;
	yAxis: number;
}): React.ReactElement {
	const objectX = args.xToScreen(args.objectRef.x);
	const objectTipY = args.yAxis + args.heightToScreen(args.objectRef.height);
	const lensX = args.xToScreen(args.lensRef.x);
	const lensY = args.yAxis;
	const imageX = args.imageRef ? args.xToScreen(args.imageRef.x) : args.xToScreen(args.lensRef.x + args.lensRef.focalLength);
	const imageTipY = args.imageRef
		? args.yAxis + args.heightToScreen(args.imageRef.height)
		: args.yAxis + args.heightToScreen(args.objectRef.height * -0.8);

	return (
		<g>
			<line
				x1={objectX}
				y1={objectTipY}
				x2={lensX}
				y2={objectTipY}
				stroke="currentColor"
				strokeWidth={1.4}
				strokeOpacity={0.75}
			/>
			<line
				x1={lensX}
				y1={objectTipY}
				x2={imageX}
				y2={imageTipY}
				stroke="currentColor"
				strokeWidth={1.4}
				strokeOpacity={0.75}
				strokeDasharray={args.imageRef?.dashed ? "4 3" : undefined}
			/>
			<line
				x1={objectX}
				y1={objectTipY}
				x2={lensX}
				y2={lensY}
				stroke="currentColor"
				strokeWidth={1.4}
				strokeOpacity={0.75}
			/>
			<line
				x1={lensX}
				y1={lensY}
				x2={imageX}
				y2={imageTipY}
				stroke="currentColor"
				strokeWidth={1.4}
				strokeOpacity={0.75}
				strokeDasharray={args.imageRef?.dashed ? "4 3" : undefined}
			/>
		</g>
	);
}

function componentLabel(
	component: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>["components"][number],
): string | null {
	switch (component.type) {
		case "battery":
			return component.label ?? `${pretty(component.emfVolts)} V`;
		case "resistor":
			return component.label ?? `${pretty(component.resistanceOhms)} Ω`;
		case "switch":
			return component.label ?? (component.closed ? "closed" : "open");
		case "wire":
			return null;
		default:
			return component.label ?? null;
	}
}

function textIf(
	cond: boolean,
	node: React.ReactElement,
): React.ReactElement | null {
	return cond ? node : null;
}

function pretty(n: number): string {
	if (Number.isInteger(n)) return String(n);
	return Number(n.toFixed(2)).toString();
}
