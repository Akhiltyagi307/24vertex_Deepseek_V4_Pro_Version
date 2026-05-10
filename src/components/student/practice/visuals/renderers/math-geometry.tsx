"use client";

import * as React from "react";
import {
	Coordinates,
	Mafs,
	Polygon as MafsPolygon,
	Theme,
	Circle as MafsCircle,
	Line,
	Point as MafsPoint,
	Vector as MafsVector,
} from "mafs";

import "mafs/core.css";
import "mafs/font.css";

import type { MathGeometrySpec } from "@/lib/practice/visuals/types";

/**
 * `math_geometry` renderer.
 *
 * Routes the spec's primitives onto Mafs — points, segments, polygons,
 * vectors, angle markers, circles. The dispatcher wraps us in a <figure>
 * with an aria-label so we do not duplicate accessibility metadata here.
 *
 * Heavy dependency: Mafs and its CSS bundle. Imported only when the
 * renderer is loaded via `next/dynamic({ ssr: false })` from the
 * dispatcher.
 */
export function MathGeometry({ spec }: { spec: MathGeometrySpec }): React.ReactElement {
	const { view, primitives } = spec;
	return (
		<div className="w-full max-w-[480px]">
			<Mafs
				viewBox={{
					x: [view.xMin, view.xMax],
					y: [view.yMin, view.yMax],
					padding: 0.5,
				}}
				preserveAspectRatio="contain"
				zoom={false}
				pan={false}
			>
				{view.showAxes ? (
					<Coordinates.Cartesian subdivisions={view.showGrid ? 2 : false} />
				) : null}
				{primitives.map((p, i) => renderPrimitive(p, i))}
			</Mafs>
		</div>
	);
}

function renderPrimitive(
	primitive: MathGeometrySpec["primitives"][number],
	idx: number,
): React.ReactElement | null {
	switch (primitive.type) {
		case "point":
			return (
				<MafsPoint key={`p-${idx}`} x={primitive.at.x} y={primitive.at.y} color={Theme.indigo} />
			);
		case "segment":
			return (
				<Line.Segment
					key={`s-${idx}`}
					point1={[primitive.from.x, primitive.from.y]}
					point2={[primitive.to.x, primitive.to.y]}
					color={Theme.foreground}
					weight={2}
					style={primitive.dashed ? "dashed" : "solid"}
				/>
			);
		case "polygon":
			return (
				<MafsPolygon
					key={`g-${idx}`}
					points={primitive.vertices.map((v) => [v.x, v.y])}
					color={Theme.green}
					fillOpacity={primitive.filled ? 0.2 : 0}
					strokeOpacity={1}
				/>
			);
		case "vector":
			return (
				<MafsVector
					key={`v-${idx}`}
					tail={[primitive.from.x, primitive.from.y]}
					tip={[primitive.to.x, primitive.to.y]}
					color={Theme.red}
				/>
			);
		case "angle_marker":
			// Mafs lacks a dedicated angle-arc primitive; we approximate with
			// the two ray segments. The label (if any) is conveyed via the
			// figure's aria-label rather than on-canvas text in v1.
			return (
				<React.Fragment key={`a-${idx}`}>
					<Line.Segment
						point1={[primitive.vertex.x, primitive.vertex.y]}
						point2={[primitive.fromRayPoint.x, primitive.fromRayPoint.y]}
						color={Theme.foreground}
						weight={2}
					/>
					<Line.Segment
						point1={[primitive.vertex.x, primitive.vertex.y]}
						point2={[primitive.toRayPoint.x, primitive.toRayPoint.y]}
						color={Theme.foreground}
						weight={2}
					/>
				</React.Fragment>
			);
		case "circle":
			return (
				<MafsCircle
					key={`c-${idx}`}
					center={[primitive.center.x, primitive.center.y]}
					radius={primitive.radius}
					color={Theme.blue}
				/>
			);
		default:
			return null;
	}
}
