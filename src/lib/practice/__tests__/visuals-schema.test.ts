import { describe, expect, it } from "vitest";

import { VISUAL_EXEMPLARS, pickExemplarsForSubject } from "../visuals/exemplars";
import {
	parseStoredQuestionVisual,
	parseStoredQuestionVisualFromMetadata,
} from "../visuals/parse-stored";
import {
	QUESTION_VISUAL_KINDS,
	questionVisualEnvelopeSchema,
	questionVisualSpecSchema,
} from "../visuals/schemas";

describe("question visual envelope schema", () => {
	it("round-trips every exemplar", () => {
		for (const ex of VISUAL_EXEMPLARS) {
			if (ex.visual == null) continue;
			const parsed = questionVisualEnvelopeSchema.safeParse(ex.visual);
			expect(parsed.success, `Exemplar "${ex.stem}" should parse`).toBe(true);
			if (!parsed.success) continue;
			expect(parsed.data.spec.kind).toMatch(
				/^(math_geometry|math_function_plot|number_line|physics_diagram|chemistry_molecule|chemistry_reaction|accountancy_table|economics_curve|statistics_chart|data_table|english_passage)$/,
			);
		}
	});

	it("rejects an empty caption", () => {
		const result = questionVisualEnvelopeSchema.safeParse({
			caption: "",
			altText: "non-empty",
			spec: { kind: "math_function_plot", xMin: 0, xMax: 1, yMin: null, yMax: null, xLabel: null, yLabel: null, items: [{ expr: "x", color: null, label: null }] },
		});
		expect(result.success).toBe(false);
	});

	it("rejects an unknown kind", () => {
		const result = questionVisualSpecSchema.safeParse({ kind: "alien_diagram" });
		expect(result.success).toBe(false);
	});

	it("rejects a free-body diagram with zero forces", () => {
		const result = questionVisualSpecSchema.safeParse({
			kind: "physics_diagram",
			subKind: "free_body",
			bodyLabel: "Block",
			forces: [],
			inclineDeg: null,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a chemistry molecule whose smiles is empty", () => {
		const result = questionVisualSpecSchema.safeParse({
			kind: "chemistry_molecule",
			smiles: "",
			display: "2d",
			label: null,
		});
		expect(result.success).toBe(false);
	});

	it("exposes a stable list of kinds covering every exemplar", () => {
		const exemplarKinds = new Set(
			VISUAL_EXEMPLARS.filter((ex) => ex.visual !== null).map((ex) => ex.visual!.spec.kind),
		);
		for (const kind of exemplarKinds) {
			expect(QUESTION_VISUAL_KINDS).toContain(kind);
		}
	});
});

describe("parseStoredQuestionVisual", () => {
	it("treats null/undefined as 'no visual'", () => {
		expect(parseStoredQuestionVisual(null)).toEqual({ ok: true, envelope: null });
		expect(parseStoredQuestionVisual(undefined)).toEqual({ ok: true, envelope: null });
	});

	it("parses a well-formed envelope", () => {
		const envelope = VISUAL_EXEMPLARS[1]?.visual; // math_geometry exemplar
		expect(envelope).toBeTruthy();
		const result = parseStoredQuestionVisual(envelope);
		expect(result.ok).toBe(true);
	});

	it("returns ok=false with a reason on a malformed envelope", () => {
		const result = parseStoredQuestionVisual({
			caption: "x",
			altText: "y",
			spec: { kind: "math_geometry" },
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason.length).toBeGreaterThan(0);
		}
	});

	it("reads metadata.visual safely from a metadata blob", () => {
		const metadata = { foo: "bar", visual: VISUAL_EXEMPLARS[1]!.visual };
		const result = parseStoredQuestionVisualFromMetadata(metadata);
		expect(result.ok).toBe(true);
	});

	it("handles metadata blobs with no visual key", () => {
		expect(parseStoredQuestionVisualFromMetadata({ foo: "bar" })).toEqual({
			ok: true,
			envelope: null,
		});
	});
});

describe("pickExemplarsForSubject", () => {
	it("returns at least one math exemplar for mathematics", () => {
		const picks = pickExemplarsForSubject("mathematics", 4);
		expect(picks.length).toBeGreaterThan(0);
		expect(picks.length).toBeLessThanOrEqual(4);
		expect(picks.some((ex) => ex.subjects.includes("mathematics"))).toBe(true);
	});

	it("always anchors with a null-visual exemplar when padding", () => {
		const picks = pickExemplarsForSubject("english", 4);
		expect(picks.some((ex) => ex.visual === null)).toBe(true);
	});
});
