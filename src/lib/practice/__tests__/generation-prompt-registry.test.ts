import { describe, expect, it } from "vitest";

import type { PracticeGenerationPromptCategory11_12 } from "../generation-prompt-registry";
import {
	getPracticeGenerationPromptBand,
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "../generation-prompt-registry";
import { buildPracticeSystemPrompt } from "../system-prompt";
import type { PracticeUserMessagePayload } from "../user-message";

const SENIOR_CATEGORY_ANCHORS: Array<{
	category: PracticeGenerationPromptCategory11_12;
	/** Stable substring inside that category's examiner line */
	anchor: string;
}> = [
	{ category: "english", anchor: "NCERT English" },
	{ category: "physics", anchor: "NCERT Physics" },
	{ category: "chemistry", anchor: "NCERT Chemistry" },
	{ category: "biology", anchor: "NCERT Biology" },
	{ category: "mathematics", anchor: "NCERT Mathematics" },
	{ category: "accountancy", anchor: "NCERT Accountancy" },
	{ category: "business_studies", anchor: "NCERT Business Studies" },
	{ category: "economics_statistics", anchor: "NCERT Economics" },
];

function minimalPracticeUserSummary(
	difficulty: PracticeUserMessagePayload["test_parameters"]["difficulty"] = "medium",
): Pick<PracticeUserMessagePayload, "schema_version" | "intent" | "test_parameters" | "constraints"> {
	return {
		schema_version: 3,
		intent: "generate_practice_test",
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			pedagogy: "",
		},
		test_parameters: {
			difficulty,
			time_limit_seconds: 1800,
			estimated_question_count: 15,
			topic_count: 3,
			coverage_mode: "balanced",
			coverage_instruction: "Distribute evenly.",
			question_type_counts: {
				multiple_choice: 8,
				fill_in_blank: 2,
				short_answer: 3,
				long_answer: 2,
			},
			context_quality_instruction: "ok.",
			allowed_topic_ids: [],
			visuals_policy: {
				enabled: false,
				preferred_kinds: [],
				max_non_null_visuals: 0,
			},
			grounding_policy: { mode: "chunk_aligned", prefer_chunk_aligned_items: true },
		},
	};
}

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
		expect(text).toContain("Chunk alignment");
		expect(text).toContain("strict JSON");
	});

	it("declares shared Visuals precedence over subject null defaults", () => {
		const text = getPracticeGenerationSubjectPreamble({ band: "6_10", category: "mathematics" }, {
			subjectName: "Mathematics",
			subjectGrade: 10,
		});
		expect(text).toContain("If the shared Visuals section is enabled");
		expect(text).toContain("supersedes any subject-specific default to `visual: null`");
	});

	it("aligns subject preambles with maximal-visuals routing", () => {
		const mathMiddle = getPracticeGenerationSubjectPreamble({ band: "6_10", category: "mathematics" }, {
			subjectName: "Mathematics",
			subjectGrade: 10,
		});
		expect(mathMiddle).not.toContain("Pure algebra, identities, simplification, equation-solving, and proofs use `visual: null`");
		expect(mathMiddle).toContain("Even algebraic or equation-solving items may use a minimal allowed visual");

		const mathSenior = getPracticeGenerationSubjectPreamble({ band: "11_12", category: "mathematics" }, {
			subjectName: "Mathematics",
			subjectGrade: 12,
		});
		expect(mathSenior).not.toContain("Pure algebra, identities, integration techniques, matrix arithmetic, and proofs use `visual: null`");
		expect(mathSenior).toContain("minimal allowed visual");

		const biology = getPracticeGenerationSubjectPreamble({ band: "11_12", category: "biology" }, {
			subjectName: "Biology",
			subjectGrade: 12,
		});
		expect(biology).not.toContain("keep those items textual (`visual: null`) unless you reframe");
		expect(biology).toContain("prefer an allowed `data_table` or `statistics_chart`");

		const accountancy = getPracticeGenerationSubjectPreamble({ band: "11_12", category: "accountancy" }, {
			subjectName: "Accountancy",
			subjectGrade: 12,
		});
		expect(accountancy).not.toContain("Theory items use `visual: null`");
		expect(accountancy).toContain("Theory items typically stay textual");
		// Visuals must not be hard-mandated (the old "MUST emit accountancy_table"
		// clause was driving the model into a prompt contradiction during parallel
		// batch drafting where the schema forces `visual: null`).
		expect(accountancy).not.toContain(
			"MUST emit an `accountancy_table` visual showing either the GIVEN",
		);
	});
});

describe("senior-secondary (11–12) preamble subject discipline", () => {
	it.each(SENIOR_CATEGORY_ANCHORS)(
		"category $category includes discipline header, anchor, and Never key bans",
		({ category, anchor }) => {
			const text = getPracticeGenerationSubjectPreamble({ band: "11_12", category }, {
				subjectName: "Sample",
				subjectGrade: 11,
			});
			expect(text).toContain("## Subject discipline (specific bans)");
			expect(text).toContain(anchor);
			expect(text).toContain("Never key");
		},
	);

	it("default 11–12 preamble carries subject-discipline bans and glossary-flashcards warning", () => {
		const text = getPracticeGenerationSubjectPreamble({ band: "11_12", category: "default" }, {
			subjectName: "Painting",
			subjectGrade: 11,
		});
		expect(text).toContain("## Subject discipline (specific bans)");
		expect(text).toContain("glossary flashcards");
	});
});

describe("buildPracticeSystemPrompt — shared Subject discipline gate", () => {
	it("includes universal Subject discipline heading and FINAL CHECKLIST self-audit lines for Physics/Chemistry routing", () => {
		const user = minimalPracticeUserSummary("medium");

		const physicsPrompt = buildPracticeSystemPrompt({
			userMessageSummary: user,
			generationSubject: {
				subjectName: "Physics Part 1",
				subjectGrade: 11,
				subjectGroup: "Physics",
				studentGrade: 11,
			},
		});
		expect(physicsPrompt.indexOf("## HARD GATES")).toBeLessThan(
			physicsPrompt.indexOf("## Subject discipline (every question must teach the SUBJECT)"),
		);
		expect(physicsPrompt).toContain("NCERT Physics");
		expect(physicsPrompt).toContain("- Subject-discipline check:");
		expect(physicsPrompt).toContain("- Cognitive-demand check:");
		expect(physicsPrompt).toContain("- Sanity check:");
		expect(physicsPrompt).toContain("`correct_answer` agrees with the explanation");

		const chemPrompt = buildPracticeSystemPrompt({
			userMessageSummary: user,
			generationSubject: {
				subjectName: "Chemistry Part 2",
				subjectGrade: 11,
				subjectGroup: "Chemistry",
				studentGrade: 11,
			},
		});
		expect(chemPrompt).toContain("NCERT Chemistry");
		expect(chemPrompt).toContain("## Subject discipline (every question must teach the SUBJECT)");
		expect(chemPrompt).toContain("bare four-digit calendar year");
	});
});
