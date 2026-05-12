import { describe, expect, it } from "vitest";

import { pickExemplarsForSubject, VISUAL_EXEMPLARS } from "../exemplars";
import { questionVisualEnvelopeSchema } from "../schemas";

describe("visual exemplars", () => {
	const SUBJECT_KEYS = [
		"mathematics",
		"physics",
		"chemistry",
		"biology",
		"accountancy",
		"economics_statistics",
		"business_studies",
		"geography",
		"social_science",
		"science",
		"english",
	] as const;

	const ALLOWED_KINDS_BY_SUBJECT = {
		mathematics: new Set(["math_geometry", "math_function_plot", "number_line", "data_table"]),
		physics: new Set(["physics_diagram", "math_function_plot", "data_table"]),
		chemistry: new Set(["chemistry_molecule", "chemistry_reaction"]),
		biology: new Set(["data_table", "statistics_chart"]),
		accountancy: new Set(["accountancy_table"]),
		economics_statistics: new Set([
			"economics_curve",
			"statistics_chart",
			"data_table",
			"math_function_plot",
		]),
		business_studies: new Set([
			"statistics_chart",
			"data_table",
			"economics_curve",
			"math_function_plot",
		]),
		geography: new Set(["india_map", "statistics_chart", "data_table", "math_function_plot"]),
		social_science: new Set(["india_map", "statistics_chart", "data_table", "math_function_plot"]),
		science: new Set([
			"physics_diagram",
			"math_function_plot",
			"chemistry_molecule",
			"chemistry_reaction",
			"data_table",
			"statistics_chart",
		]),
		english: new Set(["english_passage"]),
	} as const;

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

	it("keeps picks subject-scoped (no cross-subject borrowing)", () => {
		for (const subject of SUBJECT_KEYS) {
			const ownCount = VISUAL_EXEMPLARS.filter((ex) => ex.subjects.includes(subject)).length;
			const picked = pickExemplarsForSubject(subject, 8);
			expect(picked.length).toBeLessThanOrEqual(ownCount);
			expect(
				picked.every((ex) => ex.subjects.includes(subject)),
				`Found borrowed exemplar in ${subject} picks`,
			).toBe(true);
		}
	});

	it("keeps exemplar subject tags aligned with routed visual kinds", () => {
		for (const ex of VISUAL_EXEMPLARS) {
			if (ex.visual == null) continue;
			const kind = ex.visual.spec.kind;
			for (const subject of ex.subjects) {
				expect(
					ALLOWED_KINDS_BY_SUBJECT[subject].has(kind),
					`Kind ${kind} is not routed for subject ${subject} (stem: ${ex.stem})`,
				).toBe(true);
			}
		}
	});

	it("surfaces diverse non-null visual families within the default cap", () => {
		const econ = pickExemplarsForSubject("economics_statistics", 8);
		const econKinds = new Set(econ.map((ex) => ex.visual?.spec.kind ?? "null"));
		expect(econKinds.has("statistics_chart")).toBe(true);
		expect(econKinds.has("economics_curve")).toBe(true);
		expect(econKinds.has("data_table")).toBe(true);

		const geo = pickExemplarsForSubject("geography", 8);
		const geoKinds = new Set(geo.map((ex) => ex.visual?.spec.kind ?? "null"));
		expect(geoKinds.has("statistics_chart")).toBe(true);
		expect(geoKinds.has("india_map")).toBe(true);
		expect(geoKinds.has("data_table")).toBe(true);
	});

	it("covers every shipped visual kind with at least one exemplar", () => {
		const visualKinds = new Set(
			VISUAL_EXEMPLARS
				.filter((ex): ex is (typeof VISUAL_EXEMPLARS)[number] & { visual: NonNullable<(typeof VISUAL_EXEMPLARS)[number]["visual"]> } => ex.visual != null)
				.map((ex) => ex.visual.spec.kind),
		);
		expect(visualKinds).toEqual(
			new Set([
				"math_geometry",
				"math_function_plot",
				"number_line",
				"physics_diagram",
				"chemistry_molecule",
				"chemistry_reaction",
				"accountancy_table",
				"economics_curve",
				"statistics_chart",
				"data_table",
				"india_map",
				"english_passage",
			]),
		);
	});

	it("covers all physics, statistics, and accountancy sub-kinds", () => {
		const physicsSubKinds = new Set<string>();
		const statsSubKinds = new Set<string>();
		const accountancySubKinds = new Set<string>();
		for (const ex of VISUAL_EXEMPLARS) {
			const spec = ex.visual?.spec;
			if (!spec) continue;
			if (spec.kind === "physics_diagram") physicsSubKinds.add(spec.subKind);
			if (spec.kind === "statistics_chart") statsSubKinds.add(spec.subKind);
			if (spec.kind === "accountancy_table") accountancySubKinds.add(spec.subKind);
		}
		expect(physicsSubKinds).toEqual(new Set(["free_body", "ray_optics", "circuit"]));
		expect(statsSubKinds).toEqual(
			new Set([
				"histogram",
				"bar",
				"line",
				"scatter",
				"pie",
				"frequency_polygon",
				"ogive",
				"box",
			]),
		);
		expect(accountancySubKinds).toEqual(
			new Set([
				"journal_entry",
				"ledger",
				"trial_balance",
				"balance_sheet",
				"p_and_l",
				"cash_book",
				"rectification",
			]),
		);
	});

	it("keeps captions and alt text free from direct answer reveals", () => {
		const spoilerPatterns = [
			/\bcorrect answer\b/i,
			/\boption\s*[A-D]\b/i,
			/\btherefore the answer\b/i,
			/\bthe answer is\b/i,
		];
		for (const ex of VISUAL_EXEMPLARS) {
			if (ex.visual == null) continue;
			for (const pattern of spoilerPatterns) {
				expect(ex.visual.caption).not.toMatch(pattern);
				expect(ex.visual.altText).not.toMatch(pattern);
			}
		}
	});
});