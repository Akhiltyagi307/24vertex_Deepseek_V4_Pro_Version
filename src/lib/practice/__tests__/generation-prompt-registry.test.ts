import { describe, expect, it } from "vitest";

import {
	buildCompactAccountancyPreamble11_12,
	buildCompactBiologyPreamble11_12,
	buildCompactBusinessStudiesPreamble11_12,
	buildCompactChemistryPreamble11_12,
	buildCompactEconomicsPreamble11_12,
	buildCompactEnglishPreamble11_12,
	buildCompactEnglishPreamble6_10,
	buildCompactMathPreamble11_12,
	buildCompactMathPreamble6_10,
	buildCompactPhysicsPreamble11_12,
	buildCompactSciencePreamble6_10,
	buildCompactSocialSciencePreamble6_10,
	getPracticeGenerationPromptBand,
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "../generation-prompt-registry";
import type { PracticeUserMessageSummary } from "../user-message";

function makeSummary(
	overrides?: Partial<PracticeUserMessageSummary["test_parameters"]>,
): PracticeUserMessageSummary {
	return {
		schema_version: 3,
		intent: "generate_practice_test",
		test_parameters: {
			difficulty: "medium",
			time_limit_seconds: 1800,
			estimated_question_count: 12,
			topic_count: 3,
			coverage_mode: "balanced",
			coverage_instruction:
				"Topic count aligns with question count: distribute questions across topics fairly.",
			question_type_counts: {
				multiple_choice: 5,
				fill_in_blank: 3,
				short_answer: 3,
				long_answer: 1,
			},
			note: "test",
			generation_instruction: "Generate original practice questions.",
			context_quality_instruction: "Curriculum context is available.",
			...overrides,
		},
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			pedagogy: "test pedagogy",
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

	it("routes 6–10 sub-discipline names (History/Geography/Civics/Political Science/Economics) to social_science", () => {
		// Subject group present
		expect(resolvePracticeGenerationSubjectRouting(10, 10, "History", "History")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(resolvePracticeGenerationSubjectRouting(9, 9, "Geography", "Geography")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(resolvePracticeGenerationSubjectRouting(10, 10, "Civics", "Civics")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(
			resolvePracticeGenerationSubjectRouting(10, 10, "Political Science", "Political Science"),
		).toEqual({ band: "6_10", category: "social_science" });
		expect(resolvePracticeGenerationSubjectRouting(10, 10, "Economics", "Economics")).toEqual({
			band: "6_10",
			category: "social_science",
		});

		// Subject group null → name fallback
		expect(resolvePracticeGenerationSubjectRouting(10, 10, null, "History (Class 10)")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(resolvePracticeGenerationSubjectRouting(9, 9, null, "Indian Geography")).toEqual({
			band: "6_10",
			category: "social_science",
		});
		expect(resolvePracticeGenerationSubjectRouting(10, 10, null, "Civics & Citizenship")).toEqual({
			band: "6_10",
			category: "social_science",
		});
	});

	it("does NOT route Grade 11 Economics to social_science (stays on 11–12 economics_statistics)", () => {
		expect(resolvePracticeGenerationSubjectRouting(11, 11, "Economics", "Economics")).toEqual({
			band: "11_12",
			category: "economics_statistics",
		});
		expect(resolvePracticeGenerationSubjectRouting(12, 12, null, "Macroeconomics")).toEqual({
			band: "11_12",
			category: "economics_statistics",
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

describe("buildCompactMathPreamble6_10", () => {
	it("includes the load-bearing sections, the worked example, and the JSON schema shorthand", () => {
		const text = buildCompactMathPreamble6_10({
			subjectName: "Mathematics",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Mathematics examiner");
		expect(text).toContain("Grade 8");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Personalisation");
		expect(text).toContain("## Notation");
		expect(text).toContain("## Worked example");
		expect(text).toContain("kurta for ₹540");
		expect(text).toContain("MCQItem = Base &");
		expect(text).toContain("intent=generate_practice_test");
		expect(text).toContain("schema_version=3");
		// JSON-only directive must be present so the model never wraps in fences
		expect(text).toContain("JSON only");
		// No LaTeX delimiters in the preamble itself (notation rule)
		expect(text).not.toMatch(/\$\$.*\$\$/);
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 20,
			time_limit_seconds: 1500,
			question_type_counts: {
				multiple_choice: 10,
				fill_in_blank: 4,
				short_answer: 4,
				long_answer: 2,
			},
		});
		const text = buildCompactMathPreamble6_10({
			subjectName: "Mathematics",
			subjectGrade: 7,
			studentGrade: 7,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 20.");
		expect(text).toContain(
			"10 multiple_choice, 4 fill_in_blank, 4 short_answer, 2 long_answer",
		);
		// 0.8 * 1500 = 1200, 1.2 * 1500 = 1800
		expect(text).toContain("[1200, 1800]");
		// per-bucket exact-count comments in the schema
		expect(text).toContain("// exactly 10");
		expect(text).toContain("// exactly 4");
	});

	it("falls back to subject grade then to 8 when student grade is null", () => {
		const fallback1 = buildCompactMathPreamble6_10({
			subjectName: "Mathematics",
			subjectGrade: 9,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 9");

		const fallback2 = buildCompactMathPreamble6_10({
			subjectName: "Mathematics",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 8");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 7,500 chars)", () => {
		// The current compact 6–10 prompt is ~5,510 chars at typical interpolations.
		// This bound is a drift tripwire — if it fires, double-check whether new
		// content earned its keep before raising the limit.
		const text = buildCompactMathPreamble6_10({
			subjectName: "Mathematics",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(7500);
	});
});

describe("buildCompactMathPreamble11_12", () => {
	it("includes Class XI/XII framing, senior-secondary distractor anchors, and the maxima/minima example", () => {
		const text = buildCompactMathPreamble11_12({
			subjectName: "Mathematics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Class XI or XII");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Distractor anchors");
		// Signature senior-secondary errors must appear
		expect(text).toContain("Bayes");
		expect(text).toContain("dropping +C");
		expect(text).toContain("AB ≠ BA");
		// Worked example body
		expect(text).toContain("Application of Derivatives — Maxima/Minima");
		expect(text).toContain("V'(x) = 12(x − 2)(x − 9)");
		expect(text).toContain("V''(2) < 0");
		// Schema and metadata
		expect(text).toContain("MCQItem = Base &");
		expect(text).toContain("intent=generate_practice_test");
		expect(text).toContain("schema_version=3");
	});

	it("falls back to grade 12 when student and subject grade are null", () => {
		const text = buildCompactMathPreamble11_12({
			subjectName: "Mathematics",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(text).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 8,600 chars)", () => {
		// The current compact 11–12 prompt is ~6,575 chars at typical interpolations.
		// 11–12 carries a senior-secondary distractor list and the maxima/minima
		// worked example, hence the larger bound vs 6–10.
		const text = buildCompactMathPreamble11_12({
			subjectName: "Mathematics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(8600);
	});
});

describe("buildCompactSciencePreamble6_10", () => {
	it("uses Science persona and includes the load-bearing sections + Science-specific taxonomy", () => {
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("integrated Science specialist");
		expect(text).toContain("Physics, Chemistry, Biology");
		expect(text).toContain("Grade 8");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy (Science-specific)");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Personalisation");
		expect(text).toContain("## Notation");
		expect(text).toContain("## Worked example");
		// Should NOT contain Math-specific persona/example
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("kurta for ₹540");
	});

	it("includes the canonical Science misconceptions in distractor anchors", () => {
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("heat ↔ temperature");
		expect(text).toContain("voltage ↔ current");
		expect(text).toContain("photosynthesis ↔ respiration");
		expect(text).toContain("mitosis ↔ meiosis");
	});

	it("includes the Sound — Frequency and Pitch worked example", () => {
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("tuning fork");
		expect(text).toContain("256 Hz");
		expect(text).toContain("512 Hz");
		expect(text).toContain("pitch with loudness");
	});

	it("uses Science notation (Unicode chemistry, SI-only) and forbids LaTeX", () => {
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("H₂O");
		expect(text).toContain("CO₂");
		expect(text).toContain("⇌");
		expect(text).toContain("SI throughout");
		expect(text).toContain("Never mix CGS and SI");
		expect(text).toContain("No LaTeX delimiters");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 15,
			time_limit_seconds: 1200,
			question_type_counts: {
				multiple_choice: 7,
				fill_in_blank: 3,
				short_answer: 4,
				long_answer: 1,
			},
		});
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 15.");
		expect(text).toContain(
			"7 multiple_choice, 3 fill_in_blank, 4 short_answer, 1 long_answer",
		);
		// 0.8 * 1200 = 960, 1.2 * 1200 = 1440
		expect(text).toContain("[960, 1440]");
		expect(text).toContain("// exactly 7");
		expect(text).toContain("Grade 9");
	});

	it("falls back to subject grade then to 8 when student grade is null", () => {
		const fallback1 = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 10,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 10");

		const fallback2 = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 8");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 9,900 chars)", () => {
		// Science is larger than Math 6–10 by design: it carries a 6-row
		// question-type taxonomy (concept-check / application / reasoning /
		// numerical / diagram-linked / activity–assertion-reason) and a separate
		// distractor-anchors paragraph that Math doesn't need. Current prompt is
		// ~7,830 chars at typical interpolations.
		const text = buildCompactSciencePreamble6_10({
			subjectName: "Science",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(9900);
	});
});

describe("buildCompactSocialSciencePreamble6_10", () => {
	it("uses Social Science persona and includes the load-bearing sections", () => {
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT Social Science examiner");
		expect(text).toContain("History, Geography, Civics/Political Science, and Economics");
		expect(text).toContain("Grade 9");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Sensitive-topics policy");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Personalisation");
		expect(text).toContain("## Notation and conventions");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("integrated Science specialist");
		expect(text).not.toContain("kurta for ₹540");
		expect(text).not.toContain("tuning fork");
	});

	it("contains the load-bearing date-rule and sensitive-topics guards", () => {
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: makeSummary(),
		});

		// The single most important hallucination guard for Social Science
		expect(text).toContain("Never produce dates from memory");
		// Sensitive topics named explicitly
		expect(text).toContain("Partition");
		expect(text).toContain("Kashmir");
		expect(text).toContain("Emergency");
		expect(text).toContain("Never editorialise");
	});

	it("includes the canonical Social Science distractor anchors", () => {
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Lok Sabha vs Rajya Sabha");
		expect(text).toContain("Fundamental Rights vs Directive Principles");
		expect(text).toContain("primary vs secondary vs tertiary");
		expect(text).toContain("Western Ghats vs Eastern Ghats");
		expect(text).toContain("federal vs unitary");
	});

	it("includes the Federalism worked example with the cooperative-vs-uniformity misconception", () => {
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Federalism in India");
		expect(text).toContain("cooperative federalism");
		expect(text).toContain("rural employment scheme");
		expect(text).toContain("uniformity equals cooperation");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 18,
			time_limit_seconds: 2400,
			question_type_counts: {
				multiple_choice: 8,
				fill_in_blank: 4,
				short_answer: 4,
				long_answer: 2,
			},
		});
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 18.");
		expect(text).toContain(
			"8 multiple_choice, 4 fill_in_blank, 4 short_answer, 2 long_answer",
		);
		// 0.8 * 2400 = 1920, 1.2 * 2400 = 2880
		expect(text).toContain("[1920, 2880]");
		expect(text).toContain("// exactly 8");
	});

	it("falls back to subject grade then to 9 when student grade is null", () => {
		const fallback1 = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 7,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 7");

		const fallback2 = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 9");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 11,700 chars)", () => {
		// Social Science is the largest compact prompt by design: it carries the
		// 6-row taxonomy, the load-bearing "Never produce dates from memory"
		// guard, an explicit sensitive-topics policy, distractor anchors, AND a
		// place-name conventions paragraph. Current prompt is ~11,620 chars at
		// typical interpolations.
		const text = buildCompactSocialSciencePreamble6_10({
			subjectName: "Social Science",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(11700);
	});
});

describe("buildCompactEnglishPreamble6_10", () => {
	it("uses English persona with NCERT book names and includes the load-bearing sections", () => {
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE English examiner");
		// At least one NCERT book name from each grade-band must appear
		expect(text).toContain("Honeysuckle");
		expect(text).toContain("Beehive");
		expect(text).toContain("First Flight");
		expect(text).toContain("Grade 9");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Literary-voice guard");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Curriculum strands");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Personalisation");
		expect(text).toContain("## Notation and conventions");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("integrated Science specialist");
		expect(text).not.toContain("NCERT Social Science examiner");
		expect(text).not.toContain("kurta for ₹540");
		expect(text).not.toContain("tuning fork");
		expect(text).not.toContain("Federalism in India");
	});

	it("contains the load-bearing literary-voice guard and writing-skills format rule", () => {
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: makeSummary(),
		});

		// Speaker-vs-poet / narrator-vs-author guard
		expect(text).toContain("Distinguish the speaker from the poet");
		expect(text).toContain("narrator from the author");
		expect(text).toContain("never conflate them");
		expect(text).toContain("For literature items, cite the text");
		// Writing-skills format rule (rule 10)
		expect(text).toContain("format");
		expect(text).toContain("audience");
		expect(text).toContain("word count");
	});

	it("includes the canonical English distractor anchors", () => {
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 10,
			studentGrade: 10,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Speaker vs poet");
		expect(text).toContain("narrator vs author");
		expect(text).toContain("tone vs theme");
		expect(text).toContain("assertive vs aggressive");
		expect(text).toContain("reported-speech tense errors");
		expect(text).toContain("idioms confused with their literal meaning");
		expect(text).toContain("formal vs informal letter");
	});

	it("includes the Road Not Taken worked example with the speaker-vs-poet misconception", () => {
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("The Road Not Taken");
		expect(text).toContain("Robert Frost");
		expect(text).toContain("nostalgia and unresolved feeling");
		expect(text).toContain("conflating the speaker with the poet");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 14,
			time_limit_seconds: 2100,
			question_type_counts: {
				multiple_choice: 6,
				fill_in_blank: 3,
				short_answer: 3,
				long_answer: 2,
			},
		});
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 8,
			studentGrade: 8,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 14.");
		expect(text).toContain(
			"6 multiple_choice, 3 fill_in_blank, 3 short_answer, 2 long_answer",
		);
		// 0.8 * 2100 = 1680, 1.2 * 2100 = 2520
		expect(text).toContain("[1680, 2520]");
		expect(text).toContain("// exactly 6");
	});

	it("falls back to subject grade then to 8 when student grade is null", () => {
		const fallback1 = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 7,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 7");

		const fallback2 = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 8");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 14,000 chars)", () => {
		// English 6–10 carries: NCERT book-names list (Honeysuckle / Honeydew /
		// It So Happened / Beehive / Moments / First Flight / Footprints), five
		// curriculum strands with bucket mapping, the load-bearing literary-
		// voice guard, a linguistically-rich distractor list, an explicit
		// writing-skills format rule (item-writing rule 10), the *Road Not
		// Taken* literature exemplar, and the **letter-to-the-editor writing-
		// skills exemplar** added in P1/#7 (anchors format / audience / word
		// count for long_answer items — biggest English failure mode in
		// production). Current prompt ~11,890 chars at typical interpolations.
		const text = buildCompactEnglishPreamble6_10({
			subjectName: "English",
			subjectGrade: 9,
			studentGrade: 9,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(14000);
	});
});

describe("buildCompactEnglishPreamble11_12", () => {
	it("uses senior-secondary English persona with Hornbill/Snapshots/Flamingo/Vistas anchors", () => {
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE English board examiner");
		expect(text).toContain("Hornbill");
		expect(text).toContain("Snapshots");
		expect(text).toContain("Flamingo");
		expect(text).toContain("Vistas");
		expect(text).toContain("Grade 12");
		// Sections
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Literary-voice guard");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Curriculum strands");
		expect(text).toContain("## Case-based framing");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// 6–10 fingerprints absent (different worked example, different books)
		expect(text).not.toContain("Honeysuckle");
		expect(text).not.toContain("Beehive");
		expect(text).not.toContain("The Road Not Taken");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("integrated Science specialist");
		expect(text).not.toContain("NCERT Social Science examiner");
	});

	it("contains the technical-term-without-gloss rule and senior-secondary case-based framing", () => {
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Technical literary-term rule
		expect(text).toContain("technical literary terms");
		expect(text).toContain("dramatic irony");
		expect(text).toContain("without gloss");
		// Case-based framing rule
		expect(text).toContain("case-based framing");
		expect(text).toContain("100–200 word stimulus");
		// Senior-secondary writing-skills word counts
		expect(text).toContain("article 120–150");
		expect(text).toContain("speech 150–200");
		// Grammar-in-passage rule
		expect(text).toContain("grammar is almost always embedded in a passage");
	});

	it("includes the senior-secondary English distractor anchors", () => {
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 11,
			studentGrade: 11,
			userMessageSummary: makeSummary(),
		});

		// Carry-overs from 6–10
		expect(text).toContain("Speaker vs poet");
		expect(text).toContain("narrator vs author");
		// Senior-secondary additions
		expect(text).toContain("ironic vs sarcastic vs satirical");
		expect(text).toContain("allegory vs symbolism");
		expect(text).toContain("metaphor vs personification");
		expect(text).toContain("simile vs analogy");
		expect(text).toContain("article confused with those of a report or speech");
	});

	it("includes the Kamala Das worked example with the dramatic-irony pattern", () => {
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("My Mother at Sixty-Six");
		expect(text).toContain("Kamala Das");
		expect(text).toContain("smile, smile, smile");
		expect(text).toContain("Dramatic irony");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 16,
			time_limit_seconds: 2700,
			question_type_counts: {
				multiple_choice: 6,
				fill_in_blank: 4,
				short_answer: 4,
				long_answer: 2,
			},
		});
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 16.");
		expect(text).toContain(
			"6 multiple_choice, 4 fill_in_blank, 4 short_answer, 2 long_answer",
		);
		// 0.8 * 2700 = 2160, 1.2 * 2700 = 3240
		expect(text).toContain("[2160, 3240]");
		expect(text).toContain("// exactly 6");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 16,000 chars)", () => {
		// English 11–12 carries the case-based framing section, technical-term-
		// without-gloss clause, writing-skills word-count table, the *My Mother
		// at Sixty-Six* literature exemplar, and the **article-task writing-
		// skills exemplar** added in P1/#7 (anchors title / byline / structured
		// body / word count). Current prompt ~13,800 chars at typical
		// interpolations.
		const text = buildCompactEnglishPreamble11_12({
			subjectName: "English Core",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(16000);
	});
});

describe("buildCompactPhysicsPreamble11_12", () => {
	it("uses senior-secondary Physics persona and includes load-bearing sections", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Physics examiner");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Sign-convention rule");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("integrated Science specialist");
		expect(text).not.toContain("English board examiner");
		expect(text).not.toContain("Social Science examiner");
		expect(text).not.toContain("My Mother at Sixty-Six");
		expect(text).not.toContain("Federalism in India");
	});

	it("lists SI constants inline (so the model doesn't have to remember)", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("g = 9.8 m/s²");
		expect(text).toContain("e = 1.6 × 10⁻¹⁹ C");
		expect(text).toContain("c = 3 × 10⁸ m/s");
		expect(text).toContain("h = 6.63 × 10⁻³⁴ J·s");
		expect(text).toContain("ε₀");
		expect(text).toContain("μ₀");
	});

	it("scopes Class 11 vs Class 12 chapter coverage to keep model in-grade", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 anchors
		expect(text).toContain("Motion in a Plane");
		expect(text).toContain("Thermodynamics");
		expect(text).toContain("Oscillations");
		// Class 12 anchors
		expect(text).toContain("Electrostatic Potential");
		expect(text).toContain("Electromagnetic Induction");
		expect(text).toContain("Ray Optics");
		expect(text).toContain("Semiconductor Electronics");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("contains the load-bearing sign-convention rule", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Sign conventions are the primary distractor source");
		expect(text).toContain("State assumed conventions");
		// Three named domains where conventions matter
		expect(text).toContain("optics");
		expect(text).toContain("electricity");
		expect(text).toContain("thermodynamics");
	});

	it("includes the canonical Physics distractor anchors", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Vector vs scalar");
		expect(text).toContain("self-inductance vs mutual-inductance");
		expect(text).toContain("impedance vs resistance");
		expect(text).toContain("capacitors series/parallel behave opposite to resistors");
		expect(text).toContain("real vs virtual image");
		expect(text).toContain("conservative vs non-conservative");
		expect(text).toContain("centripetal force as the net inward component");
	});

	it("includes the Lens-Formula worked example with a sign-convention distractor cluster", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Lens Formula and Sign Convention");
		expect(text).toContain("convex lens");
		expect(text).toContain("1/v − 1/u = 1/f");
		expect(text).toContain("v = +60 cm");
		expect(text).toContain("flipping the sign of u");
	});

	it("uses Physics notation (vector arrows, Greek letters, SI) and forbids LaTeX", () => {
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 11,
			studentGrade: 11,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("F⃗");
		expect(text).toContain("v⃗");
		expect(text).toContain("ω");
		expect(text).toContain("SI throughout");
		expect(text).toContain("No LaTeX delimiters");
		expect(text).toContain("Significant figures");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 20,
			time_limit_seconds: 3600,
			question_type_counts: {
				multiple_choice: 8,
				fill_in_blank: 4,
				short_answer: 5,
				long_answer: 3,
			},
		});
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 20.");
		expect(text).toContain(
			"8 multiple_choice, 4 fill_in_blank, 5 short_answer, 3 long_answer",
		);
		// 0.8 * 3600 = 2880, 1.2 * 3600 = 4320
		expect(text).toContain("[2880, 4320]");
		expect(text).toContain("// exactly 8");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 14,900 chars)", () => {
		// Physics 11–12 carries the chapter-scope paragraph, inline SI
		// constants, the load-bearing sign-convention section, the 6-row
		// taxonomy, the senior-secondary distractor list, the lens-formula MCQ
		// exemplar, and the **parallel-plate capacitor derivation exemplar**
		// added in P1/#7 (anchors named-step substitution structure for
		// long_answer derivations — the high-failure-rate Physics pattern).
		// Current prompt ~12,770 chars at typical interpolations.
		const text = buildCompactPhysicsPreamble11_12({
			subjectName: "Physics Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(14900);
	});
});

describe("buildCompactChemistryPreamble11_12", () => {
	it("uses senior-secondary Chemistry persona and includes load-bearing sections", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Chemistry examiner");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Three sub-disciplines");
		expect(text).toContain("## Verification rule");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("Physics examiner");
		expect(text).not.toContain("English board examiner");
		expect(text).not.toContain("Lens Formula and Sign Convention");
	});

	it("lists standard constants and atomic masses inline", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("R = 8.314 J/mol·K");
		expect(text).toContain("F = 96500 C/mol");
		expect(text).toContain("N_A = 6.022 × 10²³");
		// Atomic masses for common elements
		expect(text).toContain("H=1");
		expect(text).toContain("C=12");
		expect(text).toContain("Cl=35.5");
	});

	it("scopes Class 11 vs Class 12 chapter coverage", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 anchors
		expect(text).toContain("Atomic Structure");
		expect(text).toContain("Hydrocarbons");
		expect(text).toContain("VSEPR");
		// Class 12 anchors
		expect(text).toContain("Electrochemistry");
		expect(text).toContain("Coordination Compounds");
		expect(text).toContain("Biomolecules");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("contains the three-sub-disciplines item-mix rule and verification rule", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Three sub-disciplines named explicitly
		expect(text).toContain("Physical");
		expect(text).toContain("Inorganic");
		expect(text).toContain("Organic");
		// Verification rule
		expect(text).toContain("Verify the chemistry before emitting");
		expect(text).toContain("balance equations");
		expect(text).toContain("oxidation states");
		expect(text).toContain("IUPAC names");
	});

	it("includes the canonical Chemistry distractor anchors", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("IUPAC priority and locant confusion");
		expect(text).toContain("Markovnikov vs anti-Markovnikov");
		expect(text).toContain("SN1 vs SN2 vs E1 vs E2");
		expect(text).toContain("LEO/GER reversed");
		expect(text).toContain("galvanic vs electrolytic");
		expect(text).toContain("molarity vs molality");
		expect(text).toContain("isomerism types confused");
	});

	it("includes the Markovnikov / peroxide-effect worked example", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 11,
			studentGrade: 11,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Markovnikov / Peroxide Effect");
		expect(text).toContain("propene");
		expect(text).toContain("Kharasch");
		expect(text).toContain("1-bromopropane");
		expect(text).toContain("missing the 'peroxide' clue");
	});

	it("uses Chemistry notation (Unicode formulas, reaction arrows, stereochemistry) and forbids LaTeX", () => {
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Unicode chemistry
		expect(text).toContain("H₂O");
		expect(text).toContain("CO₂");
		expect(text).toContain("H₂SO₄");
		expect(text).toContain("Mn²⁺");
		// Reaction arrows
		expect(text).toContain("→");
		expect(text).toContain("⇌");
		// Reagents-over-arrow convention
		expect(text).toContain("Specify reagents and conditions over the arrow");
		// Stereochemistry
		expect(text).toContain("cis-, trans-, R-, S-, E-, Z-");
		// SI + no LaTeX
		expect(text).toContain("SI throughout");
		expect(text).toContain("no LaTeX delimiters");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 18,
			time_limit_seconds: 3000,
			question_type_counts: {
				multiple_choice: 7,
				fill_in_blank: 3,
				short_answer: 5,
				long_answer: 3,
			},
		});
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 18.");
		expect(text).toContain(
			"7 multiple_choice, 3 fill_in_blank, 5 short_answer, 3 long_answer",
		);
		// 0.8 * 3000 = 2400, 1.2 * 3000 = 3600
		expect(text).toContain("[2400, 3600]");
		expect(text).toContain("// exactly 7");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 15,300 chars)", () => {
		// Chemistry 11–12 carries the chapter scope, inline constants and
		// atomic masses, three-sub-disciplines section, verification rule,
		// 6-row taxonomy, the senior-secondary distractor list (14 anchors),
		// the Unicode-chemistry notation block, the Markovnikov MCQ exemplar,
		// and the **ethanol→ethanoic-acid 3-stage organic-conversion
		// exemplar** added in P1/#7 (anchors reagents-and-conditions-over-
		// arrow convention for the high-failure-rate Chemistry long_answer
		// pattern). Current prompt ~13,090 chars at typical interpolations.
		const text = buildCompactChemistryPreamble11_12({
			subjectName: "Chemistry Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(15300);
	});
});

describe("buildCompactBiologyPreamble11_12", () => {
	it("uses senior-secondary Biology persona and includes load-bearing sections", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Biology examiner");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Hallucination guard");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("Physics examiner");
		expect(text).not.toContain("Chemistry examiner");
		expect(text).not.toContain("English board examiner");
		expect(text).not.toContain("Lens Formula and Sign Convention");
		expect(text).not.toContain("Markovnikov / Peroxide Effect");
	});

	it("contains the load-bearing hallucination guard and the NCERT-rationalisation note", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// THE most important Biology rule
		expect(text).toContain("LLMs frequently hallucinate scientist–discovery attributions");
		expect(text).toContain("species characteristics");
		expect(text).toContain("If `topic_grounding` does not specify");
		// NCERT rationalisation acknowledged
		expect(text).toContain("NCERT rationalisation");
	});

	it("scopes Class 11 vs Class 12 chapter coverage", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 anchors
		expect(text).toContain("Plant Kingdom");
		expect(text).toContain("Photosynthesis");
		expect(text).toContain("Cell Cycle");
		// Class 12 anchors
		expect(text).toContain("Sexual Reproduction");
		expect(text).toContain("Molecular Basis of Inheritance");
		expect(text).toContain("Biotechnology");
		expect(text).toContain("Biodiversity");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("includes the canonical Biology distractor anchors", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("transcription vs translation vs replication");
		expect(text).toContain("mitosis vs meiosis stage features");
		expect(text).toContain("autosomal vs sex-linked");
		expect(text).toContain("glycolysis vs Krebs vs ETS");
		expect(text).toContain("photosynthesis ↔ respiration as inverses");
		expect(text).toContain("restriction enzymes vs ligases vs polymerases");
		expect(text).toContain("in situ vs ex situ");
		expect(text).toContain("pollination vs fertilisation");
	});

	it("includes the X-linked colour-blindness worked example with joint-vs-conditional distractor", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("X-linked Recessive");
		expect(text).toContain("colour-blind");
		// Genetic notation present (escaped X^c, X^C, Y)
		expect(text).toContain("X^c Y");
		expect(text).toContain("X^C X^c");
		expect(text).toContain("X^C Y");
		// The distractor pattern
		expect(text).toContain("joint probability");
		expect(text).toContain("conditional");
	});

	it("uses Biology notation (genetic notation, scientific names, Unicode bio-chemistry)", () => {
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Genetic notation conventions
		expect(text).toContain("dominant capital letter");
		expect(text).toContain("recessive lowercase");
		expect(text).toContain("X^A / X^a");
		expect(text).toContain("describe pedigree symbols in text");
		// Scientific names italicisation rule
		expect(text).toContain("Homo sapiens");
		// Unicode chemistry in bio contexts
		expect(text).toContain("ATP");
		expect(text).toContain("NADH");
		expect(text).toContain("CO₂");
		// SI + no LaTeX
		expect(text).toContain("μm");
		expect(text).toContain("No LaTeX delimiters");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 16,
			time_limit_seconds: 2400,
			question_type_counts: {
				multiple_choice: 7,
				fill_in_blank: 3,
				short_answer: 4,
				long_answer: 2,
			},
		});
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 16.");
		expect(text).toContain(
			"7 multiple_choice, 3 fill_in_blank, 4 short_answer, 2 long_answer",
		);
		// 0.8 * 2400 = 1920, 1.2 * 2400 = 2880
		expect(text).toContain("[1920, 2880]");
		expect(text).toContain("// exactly 7");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 15,900 chars)", () => {
		// Biology 11–12 carries the chapter scope, the load-bearing
		// hallucination guard as a named section, the dense distractor list
		// (16 anchors), the genetic-notation + scientific-name + Unicode-bio-
		// chemistry notation block, the X-linked colour-blindness MCQ
		// exemplar, and the **dihybrid-cross long_answer exemplar** added in
		// P1/#7 (anchors Punnett-style multi-trait reasoning with named-law
		// justification). Current prompt ~13,690 chars at typical
		// interpolations.
		const text = buildCompactBiologyPreamble11_12({
			subjectName: "Biology Part 1",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(15900);
	});
});

describe("buildCompactAccountancyPreamble11_12", () => {
	it("uses senior-secondary Accountancy persona and includes load-bearing sections", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT Accountancy examiner");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Format compliance");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("Physics examiner");
		expect(text).not.toContain("Chemistry examiner");
		expect(text).not.toContain("Biology examiner");
		expect(text).not.toContain("X-linked Recessive");
		expect(text).not.toContain("Markovnikov / Peroxide Effect");
	});

	it("contains the load-bearing format-compliance section with markdown-table exemplars", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Format-compliance preamble
		expect(text).toContain("Format conventions are non-negotiable");
		expect(text).toContain("half the marks");
		// Journal-entry table header (signature column set)
		expect(text).toContain("| Date | Particulars | L.F. | Debit (₹) | Credit (₹) |");
		// Journal entry exemplar body
		expect(text).toContain("Cash A/c Dr.");
		expect(text).toContain("To Capital A/c");
		expect(text).toContain("(Being capital introduced into the business)");
		// T-account exemplar (signature column set)
		expect(text).toContain("| Dr | Particulars | ₹ | Cr | Particulars | ₹ |");
		// Schedule III + working notes mentioned
		expect(text).toContain("Schedule III");
		expect(text).toContain("Working Note");
		// Ratio analysis four-step sequence
		expect(text).toContain("formula → substitute values → give the ratio with units");
	});

	it("scopes Class 11 vs Class 12 chapter coverage with the right sub-discipline labels", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 (Financial Accounting) anchors
		expect(text).toContain("Financial Accounting");
		expect(text).toContain("Bank Reconciliation Statement");
		expect(text).toContain("Bills of Exchange");
		expect(text).toContain("Trial Balance");
		// Class 12 anchors
		expect(text).toContain("Partnership Firms");
		expect(text).toContain("Reconstitution");
		expect(text).toContain("Cash Flow Statement");
		expect(text).toContain("Ratio Analysis");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("specifies Indian numbering convention with concrete examples", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Indian numbering");
		expect(text).toContain("₹1,00,000");
		expect(text).toContain("one lakh");
		expect(text).toContain("₹10,00,000");
		expect(text).toContain("₹1,00,00,000");
		expect(text).toContain("one crore");
	});

	it("includes the canonical Accountancy distractor anchors", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Debit and credit reversed");
		expect(text).toContain("capital expenditure vs revenue expenditure");
		expect(text).toContain("goodwill treatment errors");
		expect(text).toContain("revaluation vs realisation");
		expect(text).toContain("operating vs investing vs financing classification in cash flow");
		expect(text).toContain("ratio formula confusion");
		expect(text).toContain("provision vs reserve");
	});

	it("includes the journal-entry worked example with the nominal-account distractor", () => {
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 11,
			studentGrade: 11,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Sharma Industries");
		expect(text).toContain("paid ₹12,000 by cheque");
		expect(text).toContain("Office Rent A/c Dr.");
		expect(text).toContain("To Bank A/c");
		expect(text).toContain("Debit all expenses and losses; credit all incomes and gains");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 16,
			time_limit_seconds: 2700,
			question_type_counts: {
				multiple_choice: 6,
				fill_in_blank: 3,
				short_answer: 4,
				long_answer: 3,
			},
		});
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 16.");
		expect(text).toContain(
			"6 multiple_choice, 3 fill_in_blank, 4 short_answer, 3 long_answer",
		);
		// 0.8 * 2700 = 2160, 1.2 * 2700 = 3240
		expect(text).toContain("[2160, 3240]");
		expect(text).toContain("// exactly 6");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 14,400 chars)", () => {
		// Accountancy is the largest 11–12 compact prompt by design: it carries
		// inline markdown-table exemplars for journal entries and T-accounts
		// (these are load-bearing — the original verbose prompt scored 88/100
		// precisely because of these), Indian numbering convention examples,
		// dense Class 11 + Class 12 chapter scope with sub-discipline labels,
		// the comprehensive distractor list, and Schedule III + working-notes
		// guidance. Expected ~12,000–12,800 chars.
		const text = buildCompactAccountancyPreamble11_12({
			subjectName: "Accountancy",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(14400);
	});
});

describe("buildCompactBusinessStudiesPreamble11_12", () => {
	it("uses senior-secondary Business Studies persona and includes load-bearing sections", () => {
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Business Studies examiner");
		expect(text).toContain("Grade 12");
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Application-first rule");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("Physics examiner");
		expect(text).not.toContain("Chemistry examiner");
		expect(text).not.toContain("Biology examiner");
		expect(text).not.toContain("NCERT Accountancy examiner");
		expect(text).not.toContain("Sharma Industries paid ₹12,000 by cheque");
	});

	it("contains the load-bearing application-first rule and statutes guard", () => {
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Application-first rule
		expect(text).toContain("Application is everything in Business Studies");
		expect(text).toContain("identify which principle, function, or concept");
		expect(text).toContain("scenario-driven stem over a definitional stem");
		// Statutes guard
		expect(text).toContain("Don't invent specific section numbers");
		expect(text).toContain("Consumer Protection Act");
		expect(text).toContain("SEBI");
		expect(text).toContain("Companies Act");
	});

	it("scopes Class 11 vs Class 12 chapter coverage", () => {
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 anchors
		expect(text).toContain("Forms of Business Organisation");
		expect(text).toContain("Sources of Business Finance");
		expect(text).toContain("Internal Trade");
		// Class 12 anchors
		expect(text).toContain("Principles of Management");
		expect(text).toContain("Fayol's 14");
		expect(text).toContain("Marketing Management");
		expect(text).toContain("Consumer Protection");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("includes the canonical Business Studies distractor anchors", () => {
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Organising vs staffing");
		expect(text).toContain("principles of management vs functions of management");
		expect(text).toContain("sole proprietorship vs partnership vs company");
		expect(text).toContain("money market vs capital market");
		expect(text).toContain("branding vs labelling");
		expect(text).toContain("Fayol's 14 principles confused");
		expect(text).toContain("unity of command vs unity of direction");
	});

	it("includes the Fayol Unity-of-Command worked example with the canonical dyad distractor", () => {
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Patel Engineering Ltd.");
		expect(text).toContain("two managers");
		expect(text).toContain("Unity of Command");
		expect(text).toContain("Unity of Direction");
		expect(text).toContain("most-confused pair");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 14,
			time_limit_seconds: 2400,
			question_type_counts: {
				multiple_choice: 6,
				fill_in_blank: 3,
				short_answer: 3,
				long_answer: 2,
			},
		});
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 14.");
		expect(text).toContain(
			"6 multiple_choice, 3 fill_in_blank, 3 short_answer, 2 long_answer",
		);
		// 0.8 * 2400 = 1920, 1.2 * 2400 = 2880
		expect(text).toContain("[1920, 2880]");
		expect(text).toContain("// exactly 6");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 17,200 chars)", () => {
		// Business Studies 11–12 carries the chapter scope, application-first
		// rule + statutes guard as named sections, the 7-row taxonomy, the
		// distractor list (15 anchors), the Fayol scenario MCQ exemplar, and
		// the **multi-part case-based long_answer exemplar** added in P1/#7
		// (200-word case + 3 sub-parts integrating Fayol + delegation/
		// decentralisation + functions of management — the gold-standard
		// Class 12 BST pattern). Current prompt ~15,030 chars at typical
		// interpolations.
		const text = buildCompactBusinessStudiesPreamble11_12({
			subjectName: "Business Studies",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(17200);
	});
});

describe("buildCompactEconomicsPreamble11_12", () => {
	it("uses senior-secondary Economics persona naming all four NCERT strands", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("NCERT/CBSE Economics examiner");
		expect(text).toContain("Statistics for Economics");
		expect(text).toContain("Indian Economic Development");
		expect(text).toContain("Introductory Microeconomics");
		expect(text).toContain("Introductory Macroeconomics");
		expect(text).toContain("Grade 12");
		// Sections
		expect(text).toContain("## Style mirroring");
		expect(text).toContain("## Strict policy-year / data hallucination guard");
		expect(text).toContain("## Four-sub-disciplines item-mix rule");
		expect(text).toContain("## Curves and graphs described in text");
		expect(text).toContain("## Hard counts");
		expect(text).toContain("## Grade calibration");
		expect(text).toContain("## Question-type taxonomy");
		expect(text).toContain("## Item-writing rules");
		expect(text).toContain("## Distractor anchors");
		expect(text).toContain("## Worked example");
		// Other-subject fingerprints absent
		expect(text).not.toContain("Mathematics examiner");
		expect(text).not.toContain("Physics examiner");
		expect(text).not.toContain("Chemistry examiner");
		expect(text).not.toContain("Biology examiner");
		expect(text).not.toContain("Business Studies examiner");
		expect(text).not.toContain("Patel Engineering Ltd.");
		expect(text).not.toContain("Sharma Industries paid ₹12,000 by cheque");
	});

	it("contains the load-bearing policy-year/data hallucination guard", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Never produce specific GDP figures");
		expect(text).toContain("AI models routinely scramble Indian-economy policy years");
		expect(text).toContain("Five-Year Plan numbers");
		// Generic-period fallback guidance
		expect(text).toContain("post-independence decade");
		expect(text).toContain("late 1980s");
		expect(text).toContain("early reform years");
		// CRR/SLR/repo rate guard mentioned
		expect(text).toContain("CRR");
		expect(text).toContain("repo rate");
	});

	it("scopes Class 11 vs Class 12 chapter coverage across all four strands", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Class 11 Statistics anchors
		expect(text).toContain("Karl Pearson's");
		expect(text).toContain("Spearman's rank");
		expect(text).toContain("Lorenz curve");
		expect(text).toContain("Index Numbers");
		// Class 11 Indian Econ Dev anchors
		expect(text).toContain("LPG reforms");
		expect(text).toContain("Comparative Development");
		// Class 12 Microeconomics anchors
		expect(text).toContain("indifference curves");
		expect(text).toContain("Perfect Competition");
		expect(text).toContain("Non-Competitive Markets");
		// Class 12 Macroeconomics anchors
		expect(text).toContain("National Income Accounting");
		expect(text).toContain("multiplier");
		expect(text).toContain("BoP");
		// Cross-grade rule
		expect(text).toContain("not introduce material outside the student's current grade level");
	});

	it("contains the four-sub-disciplines mix rule and the curves-described-in-text rule", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Sub-disciplines rule
		expect(text).toContain("four distinct strands");
		expect(text).toContain("computational");
		expect(text).toContain("descriptive/historical");
		// Curves-in-text rule
		expect(text).toContain("describe them in text");
		expect(text).toContain("axes with units");
		expect(text).toContain("equilibrium");
		// Markdown tables for Statistics data
		expect(text).toContain("markdown tables");
		expect(text).toContain("class intervals");
	});

	it("includes the canonical Economics distractor anchors", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("GDP vs GNP vs NNP");
		expect(text).toContain("movement along vs shift of the curve");
		expect(text).toContain("income effect vs substitution effect");
		expect(text).toContain("Karl Pearson's vs Spearman's correlation");
		expect(text).toContain("Laspeyres vs Paasche");
		expect(text).toContain("CPI vs WPI");
		expect(text).toContain("monetary policy instruments");
		expect(text).toContain("fiscal policy instruments");
		expect(text).toContain("primary vs revenue vs fiscal deficit");
		expect(text).toContain("current vs capital account in BoP");
	});

	it("includes the Demand movement-vs-shift worked example", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		expect(text).toContain("Demand: Movement vs Shift");
		expect(text).toContain("price of a normal good X falls");
		expect(text).toContain("extension of demand");
		expect(text).toContain("non-price determinant");
		expect(text).toContain("cause-attribution rule");
	});

	it("uses Economics notation (Σ, x̄, σ, ρ, markdown tables, ₹ Indian numbering) and forbids LaTeX", () => {
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});

		// Statistical notation
		expect(text).toContain("Σ");
		expect(text).toContain("x̄");
		expect(text).toContain("σ");
		expect(text).toContain("ρ");
		// Indian numbering
		expect(text).toContain("₹1,00,000");
		// No LaTeX
		expect(text).toContain("No LaTeX delimiters");
	});

	it("interpolates hard counts and time bounds from the user-message summary", () => {
		const summary = makeSummary({
			estimated_question_count: 18,
			time_limit_seconds: 3000,
			question_type_counts: {
				multiple_choice: 7,
				fill_in_blank: 4,
				short_answer: 4,
				long_answer: 3,
			},
		});
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: summary,
		});

		expect(text).toContain("Total items = 18.");
		expect(text).toContain(
			"7 multiple_choice, 4 fill_in_blank, 4 short_answer, 3 long_answer",
		);
		// 0.8 * 3000 = 2400, 1.2 * 3000 = 3600
		expect(text).toContain("[2400, 3600]");
		expect(text).toContain("// exactly 7");
	});

	it("falls back to subject grade then to 12 when student grade is null", () => {
		const fallback1 = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 11,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback1).toContain("Grade 11");

		const fallback2 = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: null,
			studentGrade: null,
			userMessageSummary: makeSummary(),
		});
		expect(fallback2).toContain("Grade 12");
	});

	it("stays within the token-efficiency floor (drift tripwire: ≤ 18,100 chars)", () => {
		// Economics 11–12 is the largest compact prompt. Carries four sub-
		// discipline chapter scopes (Statistics + Indian Econ Dev + Micro +
		// Macro), the load-bearing policy-year/data hallucination guard, the
		// four-sub-disciplines mix rule, the curves-in-text rule, the 7-row
		// taxonomy, the comprehensive distractor list (~22 anchors), the
		// statistical-notation block, the movement-vs-shift MCQ exemplar, and
		// the **frequency-distribution long_answer exemplar** added in P1/#7
		// (anchors markdown-table working for grouped-data Statistics
		// computation — the high-stakes Class 11 Statistics pattern). Current
		// prompt ~15,960 chars at typical interpolations.
		const text = buildCompactEconomicsPreamble11_12({
			subjectName: "Economics",
			subjectGrade: 12,
			studentGrade: 12,
			userMessageSummary: makeSummary(),
		});
		expect(text.length).toBeLessThanOrEqual(18100);
	});
});
