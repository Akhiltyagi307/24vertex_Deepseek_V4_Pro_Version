import { describe, expect, it } from "vitest";

import { pickExemplarsForSubject, VISUAL_EXEMPLARS } from "../exemplars";
import { questionVisualEnvelopeSchema } from "../schemas";

describe("visual exemplars", () => {
	it("parses every exemplar through the envelope schema", () => {
		for (const ex of VISUAL_EXEMPLARS) {
			if (ex.visual === null) continue;
			const r = questionVisualEnvelopeSchema.safeParse(ex.visual);
			expect(r.success, JSON.stringify(r.error?.format())).toBe(true);
		}
	});

	it("stratified picker prefers distinct kinds for mathematics", () => {
		const picked = pickExemplarsForSubject("mathematics", 6);
		expect(picked.length).toBeLessThanOrEqual(6);
		const kinds = picked.map((ex) => (ex.visual === null ? "null" : ex.visual.spec.kind));
		expect(new Set(kinds).size).toBeGreaterThanOrEqual(4);
	});

	it("includes a null-visual anchor for physics", () => {
		const picked = pickExemplarsForSubject("physics", 8);
		expect(picked.some((ex) => ex.visual === null)).toBe(true);
	});
});
