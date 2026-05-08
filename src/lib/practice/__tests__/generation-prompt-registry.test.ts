import { describe, expect, it } from "vitest";

import {
	getPracticeGenerationPromptBand,
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "../generation-prompt-registry";

describe("getPracticeGenerationPromptBand", () => {
	it("uses subject grade 11–12 for senior band", () => {
		expect(getPracticeGenerationPromptBand(11, 10)).toBe("11_12");
		expect(getPracticeGenerationPromptBand(12, 9)).toBe("11_12");
	});

	it("uses subject grade 6–10 for middle band", () => {
		expect(getPracticeGenerationPromptBand(10, 11)).toBe("6_10");
		expect(getPracticeGenerationPromptBand(9, null)).toBe("6_10");
	});

	it("falls back to student grade when subject grade is null", () => {
		expect(getPracticeGenerationPromptBand(null, 12)).toBe("11_12");
		expect(getPracticeGenerationPromptBand(null, 7)).toBe("6_10");
	});

	it("defaults to 6_10 when both grades are null", () => {
		expect(getPracticeGenerationPromptBand(null, null)).toBe("6_10");
	});
});

describe("resolvePracticeGenerationSubjectRouting", () => {
	it("maps grade 6–10 subject_group to categories", () => {
		expect(
			resolvePracticeGenerationSubjectRouting(9, 9, "English", "English — Beehive"),
		).toEqual({ band: "6_10", category: "english" });
		expect(resolvePracticeGenerationSubjectRouting(10, 10, "Science", "Science")).toEqual({
			band: "6_10",
			category: "science",
		});
		expect(resolvePracticeGenerationSubjectRouting(9, 9, "Social Science", "Social Science")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(resolvePracticeGenerationSubjectRouting(8, 8, "Mathematics", "Mathematics")).toEqual({
			band: "6_10",
			category: "mathematics",
		});
	});

	it("uses name fallback when subject_group is null (6–10)", () => {
		expect(resolvePracticeGenerationSubjectRouting(9, 9, null, "Science")).toEqual({
			band: "6_10",
			category: "science",
		});
		expect(resolvePracticeGenerationSubjectRouting(9, 9, null, "Social Science")).toEqual({
			band: "6_10",
			category: "social_science",
		});
	});

	it("maps grade 11–12 subject_group including accountancy and economics", () => {
		expect(resolvePracticeGenerationSubjectRouting(12, 12, "Physics", "Physics Part 1")).toEqual({
			band: "11_12",
			category: "physics",
		});
		expect(resolvePracticeGenerationSubjectRouting(12, 12, "Financial Accounting", "Part 1")).toEqual({
			band: "11_12",
			category: "accountancy",
		});
		expect(resolvePracticeGenerationSubjectRouting(11, 11, "Economics", "Microeconomics")).toEqual({
			band: "11_12",
			category: "economics_statistics",
		});
		expect(resolvePracticeGenerationSubjectRouting(12, 12, "Statistics", "Applied Stats")).toEqual({
			band: "11_12",
			category: "economics_statistics",
		});
		expect(
			resolvePracticeGenerationSubjectRouting(12, 12, "Business Studies", "Business Studies Part 1"),
		).toEqual({ band: "11_12", category: "business_studies" });
	});

	it("defaults unknown senior subjects", () => {
		expect(resolvePracticeGenerationSubjectRouting(11, 11, "Fine Arts", "Painting")).toEqual({
			band: "11_12",
			category: "default",
		});
	});
});

describe("getPracticeGenerationSubjectPreamble", () => {
	it("includes subject name and uses physics template for 11–12", () => {
		const routing = resolvePracticeGenerationSubjectRouting(11, 11, "Physics", "Physics Part 1");
		const text = getPracticeGenerationSubjectPreamble(routing, {
			subjectName: "Physics Part 1",
			subjectGrade: 11,
		});
		expect(text).toContain("Physics Part 1");
		expect(text).toContain("Grade 11");
		expect(text).toContain("NCERT Physics");
		expect(text).toContain("strict JSON");
	});
});
