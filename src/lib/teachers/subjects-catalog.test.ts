import { describe, expect, it } from "vitest";

import { formatSubjectCatalogOptionLabel } from "./subject-catalog-label";

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
