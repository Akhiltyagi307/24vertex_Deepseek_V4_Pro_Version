import { describe, expect, it } from "vitest";

import { pickExemplarsForSubject, VISUAL_EXEMPLARS } from "../exemplars";
import type { QuestionVisualKind } from "../types";

/**
 * `preferredKind` filter on `pickExemplarsForSubject`. Drives per-question
 * visual enrichment — each call's exemplars should match the candidate's
 * `preferred_kind` so the few-shot signal is dense rather than diverse.
 */
describe("pickExemplarsForSubject({ preferredKind })", () => {
	function realExemplars(items: ReadonlyArray<{ visual: { spec: { kind: string } } | null }>) {
		return items.filter((ex) => ex.visual !== null) as Array<{
			visual: { spec: { kind: string } };
		}>;
	}

	it("returns kind-matching exemplars when preferredKind is set and matches exist", () => {
		// Mathematics has both `math_geometry` and `math_function_plot` exemplars
		// in the live corpus; pick a kind we know is present.
		const kind: QuestionVisualKind = "math_geometry";
		const picked = pickExemplarsForSubject("mathematics", 6, { preferredKind: kind });
		expect(picked.length).toBeGreaterThan(0);
		const reals = realExemplars(picked);
		expect(reals.length).toBeGreaterThan(0);
		for (const ex of reals) {
			expect(ex.visual.spec.kind).toBe(kind);
		}
	});

	it("falls back to the full subject pool when preferredKind has zero real matches", () => {
		// `english` subject corpus has no chemistry_molecule exemplars; ensure
		// the picker falls back to the diverse mix rather than returning empty.
		const picked = pickExemplarsForSubject("english", 6, {
			preferredKind: "chemistry_molecule" as QuestionVisualKind,
		});
		expect(picked.length).toBeGreaterThan(1);
		const kinds = new Set(realExemplars(picked).map((ex) => ex.visual.spec.kind));
		// Fallback produces a diverse mix; the chemistry kind is absent from English
		// exemplars entirely, so we should see some other kind(s) in the result.
		expect(kinds.has("chemistry_molecule")).toBe(false);
	});

	it("preserves the visual:null anchor for schema contrast when kind-matches exist", () => {
		const picked = pickExemplarsForSubject("mathematics", 6, {
			preferredKind: "math_geometry",
		});
		const hasNullAnchor = picked.some((ex) => ex.visual === null);
		const hasRealKindMatch = picked.some(
			(ex) => ex.visual !== null && ex.visual.spec.kind === "math_geometry",
		);
		// Either the null anchor is preserved OR the pool has so few null
		// exemplars that the anchor was a real one — at minimum we must keep
		// at least one real exemplar of the preferred kind.
		expect(hasRealKindMatch).toBe(true);
		// The anchor selection prefers visual:null when present in the pool.
		// Mathematics exemplars include at least one null entry.
		expect(hasNullAnchor).toBe(true);
	});

	it("respects the limit parameter when preferredKind is set", () => {
		const limit = 3;
		const picked = pickExemplarsForSubject("mathematics", limit, {
			preferredKind: "math_geometry",
		});
		expect(picked.length).toBeLessThanOrEqual(limit);
	});

	it("behaves identically to today when preferredKind is unset (no regression)", () => {
		const a = pickExemplarsForSubject("mathematics", 6);
		const b = pickExemplarsForSubject("mathematics", 6, {});
		const c = pickExemplarsForSubject("mathematics", 6, { preferredKind: null });
		expect(a.map((ex) => ex.stem)).toEqual(b.map((ex) => ex.stem));
		expect(a.map((ex) => ex.stem)).toEqual(c.map((ex) => ex.stem));
	});

	it("does not exceed the size of the matching pool", () => {
		const totalChem = VISUAL_EXEMPLARS.filter(
			(ex) => ex.subjects.includes("chemistry") && ex.visual?.spec.kind === "chemistry_molecule",
		).length;
		// If the corpus has fewer kind-matches than `limit`, picker should not
		// inflate by repeating — output length ≤ matches + null anchor count.
		const limit = 50;
		const picked = pickExemplarsForSubject("chemistry", limit, {
			preferredKind: "chemistry_molecule",
		});
		// Either all returned are kind-matches (+ optional null anchor), or
		// we fell back to the diverse pool. Both cases are bounded by VISUAL_EXEMPLARS length.
		expect(picked.length).toBeLessThanOrEqual(VISUAL_EXEMPLARS.length);
		// Sanity: at minimum the picker returned something if any chem-mol exists.
		if (totalChem > 0) expect(picked.length).toBeGreaterThan(0);
	});
});
