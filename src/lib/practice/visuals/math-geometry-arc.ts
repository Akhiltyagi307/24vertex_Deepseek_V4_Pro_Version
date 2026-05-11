/**
 * Circular arc helpers for `math_geometry` compass-style constructions.
 *
 * Convention (matches Mafs / standard math axes): 0° is +x, angles increase
 * counter-clockwise; y increases upward.
 *
 * `startAngleDeg` and `endAngleDeg` are bearings from the arc centre to the two
 * endpoints on the circle. `minorArc === true` selects the shorter arc between
 * those endpoints; `false` selects the longer arc.
 */

export type Point2D = { x: number; y: number };

function degToRad(d: number): number {
	return (d * Math.PI) / 180;
}

/** Bearing from centre → point on circle at angle (degrees, CCW from +x). */
export function pointOnArc(center: Point2D, radius: number, angleDeg: number): Point2D {
	const t = degToRad(angleDeg);
	return { x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) };
}

/**
 * CCW sweep from start bearing to end bearing.
 * Returns signed angular span in radians in (-2π, 2π), choosing minor or major arc.
 */
export function arcSweepRadians(startAngleDeg: number, endAngleDeg: number, minorArc: boolean): number {
	const s = degToRad(startAngleDeg);
	const e = degToRad(endAngleDeg);
	let diff = e - s;
	diff = ((diff + Math.PI * 3) % (2 * Math.PI)) - Math.PI;
	if (minorArc) {
		if (diff > Math.PI) diff -= 2 * Math.PI;
		if (diff < -Math.PI) diff += 2 * Math.PI;
	} else {
		if (diff > 0 && diff < Math.PI) diff -= 2 * Math.PI;
		else if (diff < 0 && diff > -Math.PI) diff += 2 * Math.PI;
		else if (diff === 0) diff = 2 * Math.PI;
	}
	return diff;
}

/** Sample points along the arc for PDF / hit-testing (inclusive endpoints). */
export function sampleArcPolyline(
	center: Point2D,
	radius: number,
	startAngleDeg: number,
	endAngleDeg: number,
	minorArc: boolean,
	steps = 48,
): Point2D[] {
	const s = degToRad(startAngleDeg);
	const sweep = arcSweepRadians(startAngleDeg, endAngleDeg, minorArc);
	const pts: Point2D[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = s + (sweep * i) / steps;
		pts.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
	}
	return pts;
}

/** Mid-bearing (degrees) for optional labels. */
export function arcMidAngleDeg(startAngleDeg: number, endAngleDeg: number, minorArc: boolean): number {
	const s = degToRad(startAngleDeg);
	const sweep = arcSweepRadians(startAngleDeg, endAngleDeg, minorArc);
	const mid = s + sweep / 2;
	const deg = (mid * 180) / Math.PI;
	return ((deg % 360) + 360) % 360;
}
