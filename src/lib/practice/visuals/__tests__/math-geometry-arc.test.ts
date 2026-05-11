import { describe, expect, it } from "vitest";

import {
	arcMidAngleDeg,
	arcSweepRadians,
	pointOnArc,
	sampleArcPolyline,
} from "../math-geometry-arc";

describe("math-geometry-arc", () => {
	it("computes a quarter-turn minor sweep", () => {
		expect(arcSweepRadians(0, 90, true)).toBeCloseTo(Math.PI / 2, 8);
	});

	it("prefers the shorter arc between bearings that are far apart", () => {
		const sweep = arcSweepRadians(30, 330, true);
		expect(Math.abs(sweep)).toBeCloseTo(Math.PI / 3, 8);
	});

	it("selects the longer arc when minorArc is false for the same endpoints", () => {
		const minor = arcSweepRadians(30, 330, true);
		const major = arcSweepRadians(30, 330, false);
		expect(Math.abs(major)).toBeCloseTo(2 * Math.PI - Math.abs(minor), 8);
	});

	it("samples endpoints on the circle", () => {
		const c = { x: 1, y: 2 };
		const r = 3;
		const pts = sampleArcPolyline(c, r, 0, 90, true, 12);
		expect(pts.length).toBe(13);
		const start = pts[0]!;
		const end = pts[pts.length - 1]!;
		expect(start.x).toBeCloseTo(c.x + r, 8);
		expect(start.y).toBeCloseTo(c.y, 8);
		expect(end.x).toBeCloseTo(c.x, 8);
		expect(end.y).toBeCloseTo(c.y + r, 8);
	});

	it("arcMidAngleDeg lies between start and end along the chosen arc", () => {
		const mid = arcMidAngleDeg(0, 90, true);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(90);
	});

	it("pointOnArc matches cosine/sine convention", () => {
		const p = pointOnArc({ x: 0, y: 0 }, 2, 180);
		expect(p.x).toBeCloseTo(-2, 8);
		expect(p.y).toBeCloseTo(0, 8);
	});
});
