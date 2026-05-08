import { describe, expect, it } from "vitest";

import { buildPracticeSystemPrompt } from "../system-prompt";
import type { PracticeUserMessageSummary } from "../user-message";

function makeSummary(): PracticeUserMessageSummary {
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
		},
		constraints: {
			question_types: ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"],
			pedagogy: "test pedagogy",
		},
	};
}

describe("buildPracticeSystemPrompt — Mathematics routing", () => {
	it("returns the compact 6–10 prompt for Math 6–10 (no shared-instructions tail)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Mathematics",
				subjectGrade: 8,
				subjectGroup: "Mathematics",
				studentGrade: 8,
			},
		});

		// Compact prompt fingerprint: worked example + JSON shorthand
		expect(text).toContain("kurta for ₹540");
		expect(text).toContain("MCQItem = Base &");
		// Shared-instructions fingerprint must be absent (no double-contract)
		expect(text).not.toContain("Schema marker:");
		expect(text).not.toContain("Bloom-inspired cognitive demand");
	});

	it("returns the compact 11–12 prompt for Math 11–12", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Mathematics",
				subjectGrade: 12,
				subjectGroup: "Mathematics",
				studentGrade: 12,
			},
		});

		expect(text).toContain("Class XI or XII");
		expect(text).toContain("Application of Derivatives — Maxima/Minima");
		expect(text).not.toContain("Schema marker:");
	});

	it("uses the verbose preamble + shared instructions for non-migrated 11–12 subjects (e.g., Sociology — falls through to default)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Sociology",
				subjectGrade: 12,
				subjectGroup: "Sociology",
				studentGrade: 12,
			},
		});

		// Verbose preamble fingerprint (Sociology falls through to default)
		expect(text).toContain("Sociology");
		expect(text).toContain("Grade 12");
		// Shared-instructions tail must be present for non-migrated subjects
		expect(text).toContain("Schema marker:");
		expect(text).toContain("Bloom-inspired cognitive demand");
		// Compact-prompt fingerprint must be absent
		expect(text).not.toContain("MCQItem = Base &");
	});

	it("routes by category, not subject name (so 'Maths' / 'Math' resolve to compact)", () => {
		const variants = [
			{ subjectGroup: "Mathematics", subjectName: "Maths" },
			{ subjectGroup: null, subjectName: "Mathematics" },
			{ subjectGroup: null, subjectName: "Math Part A" },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: 9,
					subjectGroup: variant.subjectGroup,
					studentGrade: 9,
				},
			});
			expect(text).toContain("MCQItem = Base &");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Science routing", () => {
	it("returns the compact Science prompt for Science 6–10 (no shared-instructions tail)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Science",
				subjectGrade: 8,
				subjectGroup: "Science",
				studentGrade: 8,
			},
		});

		// Compact Science fingerprint
		expect(text).toContain("integrated Science specialist");
		expect(text).toContain("tuning fork");
		expect(text).toContain("MCQItem = Base &");
		// Shared-instructions fingerprint must be absent (no double-contract)
		expect(text).not.toContain("Schema marker:");
		expect(text).not.toContain("Bloom-inspired cognitive demand");
		// Math fingerprint must NOT appear
		expect(text).not.toContain("kurta for ₹540");
	});

	it("routes by category for Science name variants", () => {
		const variants = [
			{ subjectGroup: "Science", subjectName: "Science" },
			{ subjectGroup: null, subjectName: "Science" },
			{ subjectGroup: "Science", subjectName: "General Science" },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: 9,
					subjectGroup: variant.subjectGroup,
					studentGrade: 9,
				},
			});
			expect(text).toContain("integrated Science specialist");
			expect(text).not.toContain("Schema marker:");
		}
	});

	it("does NOT route Physics 11–12 to compact Science (Physics has its own compact builder)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Physics Part 1",
				subjectGrade: 11,
				subjectGroup: "Physics",
				studentGrade: 11,
			},
		});

		// Compact-Science fingerprint must be absent (different category)
		expect(text).not.toContain("integrated Science specialist");
		expect(text).not.toContain("tuning fork");
		// Compact-Physics fingerprint present instead (this subject is migrated)
		expect(text).toContain("NCERT/CBSE Physics examiner");
		expect(text).toContain("Lens Formula and Sign Convention");
	});
});

describe("buildPracticeSystemPrompt — Social Science routing", () => {
	it("returns the compact Social Science prompt for integrated 'Social Science' 6–10", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Social Science",
				subjectGrade: 10,
				subjectGroup: "Social Science",
				studentGrade: 10,
			},
		});

		expect(text).toContain("NCERT Social Science examiner");
		expect(text).toContain("Federalism in India");
		expect(text).toContain("Never produce dates from memory");
		expect(text).toContain("MCQItem = Base &");
		// Shared-instructions tail must be absent
		expect(text).not.toContain("Schema marker:");
		expect(text).not.toContain("Bloom-inspired cognitive demand");
	});

	it("routes 6–10 sub-discipline subjects (History/Geography/Civics/Political Science/Economics) to compact Social Science", () => {
		const variants = [
			{ subjectGroup: "History", subjectName: "History (Class 10)" },
			{ subjectGroup: "Geography", subjectName: "Indian Geography" },
			{ subjectGroup: "Civics", subjectName: "Civics" },
			{ subjectGroup: "Political Science", subjectName: "Political Science" },
			{ subjectGroup: "Economics", subjectName: "Economics" },
			{ subjectGroup: null, subjectName: "History" },
			{ subjectGroup: null, subjectName: "Civics & Citizenship" },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: 10,
					subjectGroup: variant.subjectGroup,
					studentGrade: 10,
				},
			});
			expect(text).toContain("NCERT Social Science examiner");
			expect(text).toContain("Never produce dates from memory");
			expect(text).not.toContain("Schema marker:");
		}
	});

	it("does NOT route Grade 11 Economics to compact Social Science (the 6–10 sub-discipline routing must not bleed into 11–12)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Economics",
				subjectGrade: 11,
				subjectGroup: "Economics",
				studentGrade: 11,
			},
		});

		// Grade 11 Economics goes to its own compact 11–12 builder
		expect(text).toContain("NCERT/CBSE Economics examiner");
		expect(text).toContain("Never produce specific GDP figures");
		// Compact-Social-Science fingerprint must be absent (that's 6–10)
		expect(text).not.toContain("NCERT Social Science examiner");
		expect(text).not.toContain("Federalism in India");
		// No shared-instructions tail (compact path)
		expect(text).not.toContain("Schema marker:");
	});
});

describe("buildPracticeSystemPrompt — English routing", () => {
	it("returns the compact English prompt for English 6–10 across naming variants", () => {
		const variants = [
			{ subjectGroup: "English", subjectName: "English" },
			{ subjectGroup: "English", subjectName: "English — Beehive" },
			{ subjectGroup: "English", subjectName: "English — Honeydew" },
			{ subjectGroup: null, subjectName: "English Communicative" },
			{ subjectGroup: null, subjectName: "English Language and Literature" },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: 9,
					subjectGroup: variant.subjectGroup,
					studentGrade: 9,
				},
			});
			expect(text).toContain("NCERT/CBSE English examiner");
			expect(text).toContain("Distinguish the speaker from the poet");
			expect(text).toContain("MCQItem = Base &");
			expect(text).not.toContain("Schema marker:");
		}
	});

	it("routes 11–12 English to the compact 11–12 builder (Hornbill/Flamingo persona, no shared tail)", () => {
		const variants = [
			{ subjectGroup: "English", subjectName: "English Core", grade: 11 },
			{ subjectGroup: "English", subjectName: "English Elective", grade: 12 },
			{ subjectGroup: null, subjectName: "English Language and Literature", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Senior-secondary persona + canonical worked example
			expect(text).toContain("NCERT/CBSE English board examiner");
			expect(text).toContain("Hornbill");
			expect(text).toContain("Flamingo");
			expect(text).toContain("My Mother at Sixty-Six");
			// 6–10 books NOT present (different builder)
			expect(text).not.toContain("Honeysuckle");
			expect(text).not.toContain("The Road Not Taken");
			// No shared-tail
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Physics routing", () => {
	it("routes 11–12 Physics to the compact builder across naming variants", () => {
		const variants = [
			{ subjectGroup: "Physics", subjectName: "Physics Part 1", grade: 11 },
			{ subjectGroup: "Physics", subjectName: "Physics Part 2", grade: 12 },
			{ subjectGroup: null, subjectName: "Physics", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Physics fingerprint
			expect(text).toContain("NCERT/CBSE Physics examiner");
			expect(text).toContain("Sign conventions are the primary distractor source");
			expect(text).toContain("Lens Formula and Sign Convention");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Mathematics examiner");
			expect(text).not.toContain("English board examiner");
			expect(text).not.toContain("Chemistry examiner");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Chemistry routing", () => {
	it("routes 11–12 Chemistry to the compact builder across naming variants", () => {
		const variants = [
			{ subjectGroup: "Chemistry", subjectName: "Chemistry Part 1", grade: 11 },
			{ subjectGroup: "Chemistry", subjectName: "Chemistry Part 2", grade: 12 },
			{ subjectGroup: null, subjectName: "Chemistry", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Chemistry fingerprint
			expect(text).toContain("NCERT/CBSE Chemistry examiner");
			expect(text).toContain("Verify the chemistry before emitting");
			expect(text).toContain("Markovnikov / Peroxide Effect");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Physics examiner");
			expect(text).not.toContain("Lens Formula and Sign Convention");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Biology routing", () => {
	it("routes 11–12 Biology to the compact builder across naming variants", () => {
		const variants = [
			{ subjectGroup: "Biology", subjectName: "Biology Part 1", grade: 11 },
			{ subjectGroup: "Biology", subjectName: "Biology Part 2", grade: 12 },
			{ subjectGroup: null, subjectName: "Biology", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Biology fingerprint — most importantly the hallucination guard
			expect(text).toContain("NCERT/CBSE Biology examiner");
			expect(text).toContain("LLMs frequently hallucinate scientist–discovery attributions");
			expect(text).toContain("X-linked Recessive");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Physics examiner");
			expect(text).not.toContain("Chemistry examiner");
			expect(text).not.toContain("Markovnikov / Peroxide Effect");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Accountancy routing", () => {
	it("routes 11–12 Accountancy to the compact builder across naming variants", () => {
		const variants = [
			{ subjectGroup: "Accountancy", subjectName: "Accountancy", grade: 11 },
			{ subjectGroup: "Financial Accounting", subjectName: "Financial Accounting", grade: 11 },
			{ subjectGroup: "Accountancy", subjectName: "Accountancy Part 2", grade: 12 },
			{ subjectGroup: null, subjectName: "Accountancy", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Accountancy fingerprint — markdown-table exemplars are
			// the load-bearing distinction for this subject.
			expect(text).toContain("NCERT Accountancy examiner");
			expect(text).toContain("Format conventions are non-negotiable");
			expect(text).toContain("| Date | Particulars | L.F. | Debit (₹) | Credit (₹) |");
			expect(text).toContain("Sharma Industries");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Physics examiner");
			expect(text).not.toContain("Chemistry examiner");
			expect(text).not.toContain("Biology examiner");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Business Studies routing", () => {
	it("routes 11–12 Business Studies to the compact builder across naming variants", () => {
		const variants = [
			{ subjectGroup: "Business Studies", subjectName: "Business Studies", grade: 11 },
			{ subjectGroup: "Business Studies", subjectName: "Business Studies Part 1", grade: 11 },
			{ subjectGroup: "Business Studies", subjectName: "Business Studies Part 2", grade: 12 },
			{ subjectGroup: null, subjectName: "Business Studies", grade: 12 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Business Studies fingerprint — application-first rule
			// is the load-bearing distinction.
			expect(text).toContain("NCERT/CBSE Business Studies examiner");
			expect(text).toContain("Application is everything in Business Studies");
			expect(text).toContain("Patel Engineering Ltd.");
			expect(text).toContain("Unity of Command");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Accountancy examiner");
			expect(text).not.toContain("Format conventions are non-negotiable");
			expect(text).not.toContain("Schema marker:");
		}
	});
});

describe("buildPracticeSystemPrompt — Economics & Statistics routing", () => {
	it("routes 11–12 Economics/Statistics names to the compact builder", () => {
		const variants = [
			{ subjectGroup: "Economics", subjectName: "Economics", grade: 11 },
			{ subjectGroup: "Economics", subjectName: "Microeconomics", grade: 12 },
			{ subjectGroup: "Statistics", subjectName: "Statistics for Economics", grade: 11 },
			{ subjectGroup: null, subjectName: "Macroeconomics", grade: 12 },
			{ subjectGroup: null, subjectName: "Statistics", grade: 11 },
		];

		for (const variant of variants) {
			const text = buildPracticeSystemPrompt({
				userMessageSummary: makeSummary(),
				generationSubject: {
					subjectName: variant.subjectName,
					subjectGrade: variant.grade,
					subjectGroup: variant.subjectGroup,
					studentGrade: variant.grade,
				},
			});
			// Compact Economics fingerprint — policy-year guard + four-sub-
			// disciplines are the load-bearing distinctions.
			expect(text).toContain("NCERT/CBSE Economics examiner");
			expect(text).toContain("Never produce specific GDP figures");
			expect(text).toContain("Demand: Movement vs Shift");
			expect(text).toContain("MCQItem = Base &");
			// Other-subject fingerprints absent
			expect(text).not.toContain("Business Studies examiner");
			expect(text).not.toContain("Accountancy examiner");
			expect(text).not.toContain("Patel Engineering Ltd.");
			expect(text).not.toContain("Schema marker:");
		}
	});

	it("does NOT route Grade 9 'Economics' to compact 11–12 Economics (stays at 6–10 social_science via routing extension)", () => {
		const text = buildPracticeSystemPrompt({
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Economics",
				subjectGrade: 9,
				subjectGroup: "Economics",
				studentGrade: 9,
			},
		});

		// 6–10 Economics goes to compact Social Science (routing extension)
		expect(text).toContain("NCERT Social Science examiner");
		// Compact 11–12 Economics fingerprint must be absent
		expect(text).not.toContain("NCERT/CBSE Economics examiner");
		expect(text).not.toContain("Never produce specific GDP figures");
	});
});
