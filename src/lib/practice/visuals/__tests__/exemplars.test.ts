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

	it("surfaces business_studies exemplars with chart and table kinds", () => {
		const bs = pickExemplarsForSubject("business_studies", 8);
		expect(bs.length).toBeGreaterThan(0);
		expect(bs[0]?.subjects.includes("business_studies")).toBe(true);
		expect(bs.some((ex) => ex.subjects.includes("business_studies") && ex.visual?.spec.kind === "statistics_chart")).toBe(
			true,
		);
		expect(bs.some((ex) => ex.subjects.includes("business_studies") && ex.visual?.spec.kind === "data_table")).toBe(true);
	});

	it("surfaces geography chart exemplars for geography and social_science keys", () => {
		// Many distinct statistics_chart keys precede the first india_map in geography exemplar order;
		// a wider cap keeps maps reachable alongside charts/tables in stratified picks.
		const geo = pickExemplarsForSubject("geography", 14);
		expect(geo.length).toBeGreaterThan(0);
		expect(geo[0]?.subjects.includes("geography")).toBe(true);
		expect(
			geo.some((ex) => ex.subjects.includes("geography") && ex.visual?.spec.kind === "statistics_chart"),
		).toBe(true);
		expect(geo.some((ex) => ex.subjects.includes("geography") && ex.visual?.spec.kind === "data_table")).toBe(
			true,
		);
		expect(
			geo.some((ex) => ex.subjects.includes("geography") && ex.visual?.spec.kind === "india_map"),
		).toBe(true);

		const ss = pickExemplarsForSubject("social_science", 14);
		expect(ss[0]?.subjects.includes("social_science")).toBe(true);
		expect(ss.some((ex) => ex.subjects.includes("social_science"))).toBe(true);
	});

	it("topic hint prioritizes geography exemplars whose keywords overlap chapter text", () => {
		const cap = 12;
		const rainfallIdx = (picked: ReturnType<typeof pickExemplarsForSubject>) => {
			const i = picked.findIndex((ex) => ex.stem.toLowerCase().includes("rainfall"));
			return i === -1 ? 999 : i;
		};
		const baseline = pickExemplarsForSubject("geography", cap);
		const hinted = pickExemplarsForSubject("geography", cap, {
			topicHintNorm: "monsoon rainfall precipitation climate weather unit",
		});
		expect(hinted.some((ex) => ex.stem.toLowerCase().includes("rainfall"))).toBe(true);
		expect(rainfallIdx(hinted)).toBeLessThanOrEqual(rainfallIdx(baseline));
	});

	it("topic hint surfaces biology enzyme-table exemplar when hint mentions assay terms", () => {
		const cap = 6;
		const assayIdx = (picked: ReturnType<typeof pickExemplarsForSubject>) => {
			const i = picked.findIndex((ex) => ex.stem.toLowerCase().includes("enzyme assay"));
			return i === -1 ? 999 : i;
		};
		const baseline = pickExemplarsForSubject("biology", cap);
		const hinted = pickExemplarsForSubject("biology", cap, {
			topicHintNorm: "enzyme activity assay temperature reaction rate practical",
		});
		expect(assayIdx(hinted)).toBeLessThanOrEqual(assayIdx(baseline));
		expect(hinted.some((ex) => ex.stem.toLowerCase().includes("enzyme assay"))).toBe(true);
	});

	it("includes a null-visual anchor for physics", () => {
		const picked = pickExemplarsForSubject("physics", 8);
		expect(picked.some((ex) => ex.visual === null)).toBe(true);
	});
});