#!/usr/bin/env node
/**
 * ncert-diagram-conventions linter.
 *
 * Reads a JSON test object on stdin (the `flattened` PracticeGenerationOutput
 * shape — `{ questions: [...] }`) and writes a JSON report to stdout:
 *
 *   { ok: boolean, violations: [{ index, code, message }] }
 *
 * Each violation references the 0-based question index. The Pass-2
 * validator wraps this in a shell-tool call.
 *
 * Conventions checked (see SKILL.md):
 *   - math_geometry: every primitive within view bounds (with margin).
 *   - free_body: all forces present have a non-empty name; magnitudes > 0.
 *   - ray_optics: every lens has positive focal length; objects/images
 *     within axis range.
 *   - circuit: every component's `from`/`to` exists in `nodes`.
 *
 * Stylistic conventions (e.g., clockwise vertex labelling) are NOT
 * enforced — those are recommendations the model already gets via the
 * SKILL.md.
 */

import { readFileSync } from "node:fs";

const STDIN_FD = 0;

function readAllStdin() {
	try {
		return readFileSync(STDIN_FD, "utf8");
	} catch {
		return "";
	}
}

function lint(test) {
	const violations = [];
	const questions = Array.isArray(test?.questions) ? test.questions : [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q || typeof q !== "object") continue;
		const visual = q.visual;
		if (visual == null) continue;
		const spec = visual.spec;
		if (spec == null || typeof spec !== "object") {
			violations.push({ index: i, code: "spec_missing", message: "visual.spec is missing" });
			continue;
		}
		switch (spec.kind) {
			case "math_geometry":
				violations.push(...checkMathGeometry(i, spec));
				break;
			case "physics_diagram":
				violations.push(...checkPhysicsDiagram(i, spec));
				break;
			default:
				break;
		}
	}
	return { ok: violations.length === 0, violations };
}

function checkMathGeometry(index, spec) {
	const out = [];
	const view = spec.view;
	if (!view || typeof view.xMin !== "number" || typeof view.xMax !== "number") {
		out.push({
			index,
			code: "math_geometry.view",
			message: "view.xMin/xMax missing or non-numeric",
		});
		return out;
	}
	const margin = 1;
	const xLo = view.xMin - margin;
	const xHi = view.xMax + margin;
	const yLo = view.yMin - margin;
	const yHi = view.yMax + margin;
	for (let p = 0; p < spec.primitives.length; p++) {
		const prim = spec.primitives[p];
		const points = collectPrimitivePoints(prim);
		for (const pt of points) {
			if (pt.x < xLo || pt.x > xHi || pt.y < yLo || pt.y > yHi) {
				out.push({
					index,
					code: "math_geometry.point_out_of_view",
					message: `Primitive ${p} (${prim.type}) has a point outside the view bounds (with 1-unit margin)`,
				});
				break;
			}
		}
	}
	return out;
}

/** Numeric behaviour aligned with `src/lib/practice/visuals/math-geometry-arc.ts`. */
function arcSweepRadiansLint(startAngleDeg, endAngleDeg, minorArc) {
	const d2r = (d) => (d * Math.PI) / 180;
	const s = d2r(startAngleDeg);
	const e = d2r(endAngleDeg);
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

function sampleArcPolylineLint(center, radius, startAngleDeg, endAngleDeg, minorArc, steps = 48) {
	const s = (startAngleDeg * Math.PI) / 180;
	const sweep = arcSweepRadiansLint(startAngleDeg, endAngleDeg, minorArc);
	const pts = [];
	for (let i = 0; i <= steps; i++) {
		const t = s + (sweep * i) / steps;
		pts.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
	}
	return pts;
}

function collectPrimitivePoints(prim) {
	if (!prim || typeof prim !== "object") return [];
	switch (prim.type) {
		case "point":
			return [prim.at];
		case "segment":
			return [prim.from, prim.to];
		case "polygon":
			return Array.isArray(prim.vertices) ? prim.vertices : [];
		case "vector":
			return [prim.from, prim.to];
		case "angle_marker":
			return [prim.vertex, prim.fromRayPoint, prim.toRayPoint];
		case "circle":
			return [prim.center];
		case "arc": {
			const c = prim.center;
			if (!c || typeof c !== "object" || typeof prim.radius !== "number") return [];
			const minor = prim.minorArc == null ? true : prim.minorArc;
			const sampled = sampleArcPolylineLint(c, prim.radius, prim.startAngleDeg, prim.endAngleDeg, minor);
			return [c, ...sampled];
		}
		default:
			return [];
	}
}

function checkPhysicsDiagram(index, spec) {
	const out = [];
	switch (spec.subKind) {
		case "free_body":
			for (const [i, f] of (spec.forces ?? []).entries()) {
				if (typeof f.name !== "string" || f.name.trim().length === 0) {
					out.push({
						index,
						code: "free_body.force_unnamed",
						message: `Force ${i} has empty name`,
					});
				}
				if (typeof f.magnitude !== "number" || f.magnitude <= 0) {
					out.push({
						index,
						code: "free_body.force_magnitude",
						message: `Force ${i} (${f.name}) has non-positive magnitude`,
					});
				}
			}
			break;
		case "ray_optics":
			for (const [i, lens] of (spec.lenses ?? []).entries()) {
				if (typeof lens.focalLength !== "number" || lens.focalLength <= 0) {
					out.push({
						index,
						code: "ray_optics.focal_length",
						message: `Lens ${i} has non-positive focalLength`,
					});
				}
				if (
					typeof lens.x !== "number" ||
					lens.x < spec.axisMin - 0.5 ||
					lens.x > spec.axisMax + 0.5
				) {
					out.push({
						index,
						code: "ray_optics.lens_out_of_range",
						message: `Lens ${i} x is outside axis range`,
					});
				}
			}
			break;
		case "circuit": {
			const nodeIds = new Set((spec.nodes ?? []).map((n) => n.id));
			for (const [i, comp] of (spec.components ?? []).entries()) {
				if (!nodeIds.has(comp.from) || !nodeIds.has(comp.to)) {
					out.push({
						index,
						code: "circuit.unknown_node",
						message: `Component ${i} (${comp.type}) references node id not in nodes[]`,
					});
				}
			}
			break;
		}
		default:
			break;
	}
	return out;
}

function main() {
	const input = readAllStdin().trim();
	if (input.length === 0) {
		process.stdout.write(JSON.stringify({ ok: false, violations: [{ code: "no_input" }] }));
		process.exit(2);
	}
	let parsed;
	try {
		parsed = JSON.parse(input);
	} catch (e) {
		process.stdout.write(
			JSON.stringify({
				ok: false,
				violations: [{ code: "input_not_json", message: e instanceof Error ? e.message : "" }],
			}),
		);
		process.exit(2);
	}
	const report = lint(parsed);
	process.stdout.write(JSON.stringify(report));
	process.exit(report.ok ? 0 : 1);
}

main();
