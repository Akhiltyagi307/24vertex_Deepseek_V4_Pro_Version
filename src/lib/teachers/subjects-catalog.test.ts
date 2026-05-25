import { describe, expect, it } from "vitest";

import {
	buildSubjectCatalogPillSelectModel,
	formatSubjectCatalogOptionLabel,
} from "./subject-catalog-label";

describe("formatSubjectCatalogOptionLabel", () => {
	it("includes stream for grades 11 and 12", () => {
		expect(
			formatSubjectCatalogOptionLabel({
				id: "1",
				name: "Business Studies",
				grade: 11,
				stream: "commerce_with_maths",
			}),
		).toBe("Grade 11 · Commerce with Mathematics · Business Studies");
	});

	it("omits stream segment for lower grades", () => {
		expect(
			formatSubjectCatalogOptionLabel({
				id: "2",
				name: "English",
				grade: 6,
				stream: "commerce",
			}),
		).toBe("Grade 6 · English");
	});
});

describe("buildSubjectCatalogPillSelectModel", () => {
	it("groups grade 11–12 subjects by stream with distinct option values", () => {
		const model = buildSubjectCatalogPillSelectModel([
			{ id: "a", name: "Business Studies", grade: 11, stream: "commerce" },
			{ id: "b", name: "Business Studies", grade: 11, stream: "commerce_with_maths" },
			{ id: "c", name: "Physics Part 2", grade: 11, stream: "science_pcb" },
		]);

		expect(model.optionGroups).toHaveLength(3);
		expect(model.optionGroups.map((g) => g.heading)).toEqual([
			"Grade 11 · Science (PCB)",
			"Grade 11 · Commerce",
			"Grade 11 · Commerce with Mathematics",
		]);
		expect(model.optionGroups[1]?.options).toEqual([{ value: "a", label: "Business Studies" }]);
		expect(model.options.find((o) => o.value === "b")?.label).toBe(
			"Grade 11 · Commerce with Mathematics · Business Studies",
		);
	});

	it("uses a single grade heading for grades 6–10", () => {
		const model = buildSubjectCatalogPillSelectModel([
			{ id: "x", name: "Mathematics", grade: 10, stream: null },
			{ id: "y", name: "Science", grade: 10, stream: null },
		]);

		expect(model.optionGroups).toEqual([
			{
				heading: "Grade 10",
				options: [
					{ value: "x", label: "Mathematics" },
					{ value: "y", label: "Science" },
				],
			},
		]);
	});
});
