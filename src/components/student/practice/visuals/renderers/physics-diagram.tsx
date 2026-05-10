"use client";

import * as React from "react";

import type { PhysicsDiagramSpec } from "@/lib/practice/visuals/types";

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

			{spec.inclineDeg != null ? (
				<line
					x1={20}
					y1={SVG_SIZE - 20}
					x2={SVG_SIZE - 20}
					y2={SVG_SIZE - 20 - Math.tan((spec.inclineDeg * Math.PI) / 180) * (SVG_SIZE - 40)}
					stroke="currentColor"
					strokeWidth={1.5}
					strokeOpacity={0.6}
				/>
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
			<text
				x={CENTER}
				y={CENTER + 5}
				textAnchor="middle"
				fontSize={11}
				className="fill-foreground"
			>
				{truncate(spec.bodyLabel, 8)}
			</text>

			{spec.forces.map((force, i) => {
				const lengthPx = (force.magnitude / maxMag) * arrowMaxPx;
				const rad = (force.angleDeg * Math.PI) / 180;
				const tipX = CENTER + Math.cos(rad) * lengthPx;
				const tipY = CENTER - Math.sin(rad) * lengthPx;
				const labelX = CENTER + Math.cos(rad) * (lengthPx + 16);
				const labelY = CENTER - Math.sin(rad) * (lengthPx + 16);
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
						<text
							x={labelX}
							y={labelY}
							textAnchor="middle"
							fontSize={12}
							className="fill-foreground"
						>
							{force.name}
						</text>
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

	const xRange = spec.axisMax - spec.axisMin;
	if (xRange <= 0) {
		return (
			<span className="text-muted-foreground text-sm">Invalid ray-optics axis range.</span>
		);
	}
	const xToScreen = (x: number): number => PADDING + ((x - spec.axisMin) / xRange) * innerW;
	const heightToScreen = (h: number): number => -((h / 5) * (innerH / 2));

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

			{spec.lenses.map((lens, i) => {
				const x = xToScreen(lens.x);
				const fLeft = xToScreen(lens.x - lens.focalLength);
				const fRight = xToScreen(lens.x + lens.focalLength);
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
							y={yAxis + 16}
							textAnchor="middle"
							fontSize={10}
							className="fill-foreground"
						>
							F
						</text>
						<text
							x={fRight}
							y={yAxis + 16}
							textAnchor="middle"
							fontSize={10}
							className="fill-foreground"
						>
							F
						</text>
					</g>
				);
			})}

			{spec.objects.map((obj, i) => {
				const x = xToScreen(obj.x);
				const tipY = yAxis + heightToScreen(obj.height);
				return (
					<line
						key={`o-${i}`}
						x1={x}
						y1={yAxis}
						x2={x}
						y2={tipY}
						stroke="currentColor"
						strokeWidth={2}
						strokeDasharray={obj.dashed ? "4,3" : undefined}
						markerEnd="url(#ray-arrow)"
					/>
				);
			})}
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
}: {
	component: Extract<PhysicsDiagramSpec, { subKind: "circuit" }>["components"][number];
	a: { x: number; y: number };
	b: { x: number; y: number };
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

	switch (component.type) {
		case "wire":
			return (
				<line
					x1={a.x}
					y1={a.y}
					x2={b.x}
					y2={b.y}
					stroke="currentColor"
					strokeWidth={1.5}
				/>
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
				</g>
			);
	}
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}
