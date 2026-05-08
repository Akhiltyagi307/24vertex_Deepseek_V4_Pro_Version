/**
 * Practice prompt fixtures — one canonical scenario per migrated subject.
 *
 * Each fixture exercises:
 *   - Subject-specific persona / load-bearing-rule fingerprints (Tier 1)
 *   - Hard-counts interpolation, grade calibration (Tier 1)
 *   - Worked-example presence (Tier 1)
 *   - Output-level structural correctness — counts, topic_id provenance,
 *     time budget, MCQ parity (Tier 2, LLM eval mode only)
 *
 * The fixture set is deliberately small (one per subject) — extend with
 * edge-case fixtures (empty grounding, sub-discipline routing, sensitive
 * topics) as production failure modes are observed.
 */

import type { PracticeUserMessageSummary } from "../user-message";
import type { PracticeFixture } from "./types";

/**
 * Helper for the common test_parameters shape. Fixtures override only what
 * matters for the scenario.
 */
function makeSummary(
	overrides: {
		estimated_question_count?: number;
		time_limit_seconds?: number;
		difficulty?: PracticeUserMessageSummary["test_parameters"]["difficulty"];
		question_type_counts?: PracticeUserMessageSummary["test_parameters"]["question_type_counts"];
	} = {},
): PracticeUserMessageSummary {
	const counts = overrides.question_type_counts ?? {
		multiple_choice: 5,
		fill_in_blank: 3,
		short_answer: 3,
		long_answer: 1,
	};
	const total =
		overrides.estimated_question_count ??
		counts.multiple_choice + counts.fill_in_blank + counts.short_answer + counts.long_answer;
	return {
		schema_version: 3,
		intent: "generate_practice_test",
		test_parameters: {
			difficulty: overrides.difficulty ?? "medium",
			time_limit_seconds: overrides.time_limit_seconds ?? 1800,
			estimated_question_count: total,
			topic_count: 3,
			coverage_mode: "balanced",
			coverage_instruction:
				"Topic count aligns with question count: distribute questions across topics fairly.",
			question_type_counts: counts,
			note: "Question count and per-type counts are fixed by duration.",
			generation_instruction:
				"Generate original practice questions aligned to the supplied curriculum.",
			context_quality_instruction: "Curriculum context is available.",
		},
		constraints: {
			question_types: [
				"multiple_choice",
				"fill_in_blank",
				"short_answer",
				"long_answer",
			],
			pedagogy: "Align to NCERT outcomes for the given grade.",
		},
	};
}

/** Canonical topic-id placeholders. In production these are real UUIDs from `topics`. */
const TOPICS = {
	math8a: "00000000-0000-4000-8000-000000000001",
	math8b: "00000000-0000-4000-8000-000000000002",
	math8c: "00000000-0000-4000-8000-000000000003",
	math12a: "00000000-0000-4000-8000-000000000011",
	math12b: "00000000-0000-4000-8000-000000000012",
	science8: "00000000-0000-4000-8000-000000000021",
	socsci10: "00000000-0000-4000-8000-000000000031",
	english9: "00000000-0000-4000-8000-000000000041",
	english12: "00000000-0000-4000-8000-000000000042",
	physics12: "00000000-0000-4000-8000-000000000051",
	chemistry12: "00000000-0000-4000-8000-000000000061",
	biology12: "00000000-0000-4000-8000-000000000071",
	accountancy11: "00000000-0000-4000-8000-000000000081",
	bst12: "00000000-0000-4000-8000-000000000091",
	economics12: "00000000-0000-4000-8000-000000000101",
};

export const FIXTURES: PracticeFixture[] = [
	// ---------------------------------------------------------------------------
	// Math 6–10
	// ---------------------------------------------------------------------------
	{
		id: "math-6-10-grade-8-medium-12q",
		description:
			"Grade 8 Math, balanced difficulty, default count layout — verifies compact builder routes, interpolates counts, and embeds the kurta worked example.",
		subject: "math-6-10",
		input: {
			userMessageSummary: makeSummary({ estimated_question_count: 12 }),
			generationSubject: {
				subjectName: "Mathematics",
				subjectGrade: 8,
				subjectGroup: "Mathematics",
				studentGrade: 8,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Mathematics examiner", label: "persona" },
			{ type: "mentionsGrade", grade: 8 },
			{ type: "contains", substring: "## Style mirroring", label: "load-bearing section" },
			{ type: "interpolatesQuestionCount", expected: 12 },
			{ type: "contains", substring: "kurta for ₹540", label: "worked example" },
			{ type: "contains", substring: "MCQItem = Base &", label: "JSON contract shorthand" },
			{ type: "notContains", substring: "Schema marker:", label: "no shared-tail" },
			// LaTeX delimiter rule
			{ type: "notContains", substring: "$$", label: "no LaTeX block delimiters" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.math8a, TOPICS.math8b, TOPICS.math8c],
			},
			{ type: "noEmptyQuestions" },
			{ type: "respectsTimeBudget", timeLimit: 1800 },
			{ type: "hasAdaptationRationale" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Math 11–12
	// ---------------------------------------------------------------------------
	{
		id: "math-11-12-grade-12-hard-15q",
		description:
			"Grade 12 Math, hard difficulty, larger test — verifies senior-secondary distractor anchors and the maxima/minima exemplar.",
		subject: "math-11-12",
		input: {
			userMessageSummary: makeSummary({
				estimated_question_count: 15,
				time_limit_seconds: 2700,
				difficulty: "hard",
				question_type_counts: {
					multiple_choice: 6,
					fill_in_blank: 3,
					short_answer: 4,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Mathematics",
				subjectGrade: 12,
				subjectGroup: "Mathematics",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Mathematics examiner" },
			{ type: "contains", substring: "Class XI or XII" },
			{ type: "mentionsGrade", grade: 12 },
			{ type: "interpolatesQuestionCount", expected: 15 },
			{ type: "contains", substring: "Application of Derivatives — Maxima/Minima", label: "worked example" },
			{ type: "contains", substring: "dropping +C", label: "senior-secondary distractor anchor" },
			{ type: "contains", substring: "AB ≠ BA", label: "matrix non-commutativity anchor" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.math12a, TOPICS.math12b],
			},
			{ type: "noEmptyQuestions" },
			{ type: "respectsTimeBudget", timeLimit: 2700 },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Science 6–10
	// ---------------------------------------------------------------------------
	{
		id: "science-6-10-grade-8-balanced-12q",
		description:
			"Grade 8 Science — verifies six-type taxonomy, distractor anchors (heat ↔ temperature etc.), and the tuning-fork exemplar.",
		subject: "science-6-10",
		input: {
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Science",
				subjectGrade: 8,
				subjectGroup: "Science",
				studentGrade: 8,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "integrated Science specialist" },
			{ type: "mentionsGrade", grade: 8 },
			{ type: "contains", substring: "## Question-type taxonomy (Science-specific)" },
			{ type: "contains", substring: "heat ↔ temperature", label: "distractor anchor" },
			{ type: "contains", substring: "tuning fork", label: "worked example" },
			{ type: "contains", substring: "256 Hz" },
			{ type: "contains", substring: "Never mix CGS and SI" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.science8],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Social Science 6–10 (also tests sub-discipline routing edge case)
	// ---------------------------------------------------------------------------
	{
		id: "social-science-6-10-grade-10-via-history-name",
		description:
			"Grade 10, subject named 'History' (not 'Social Science') — verifies the routing extension catches the sub-discipline name and the load-bearing date guard fires.",
		subject: "social-science-6-10",
		input: {
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "History (Class 10)",
				subjectGrade: 10,
				subjectGroup: "History",
				studentGrade: 10,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT Social Science examiner" },
			{ type: "mentionsGrade", grade: 10 },
			{ type: "contains", substring: "Never produce dates from memory", label: "load-bearing hallucination guard" },
			{ type: "contains", substring: "## Sensitive-topics policy" },
			{ type: "contains", substring: "Lok Sabha vs Rajya Sabha" },
			{ type: "contains", substring: "Federalism in India", label: "worked example" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.socsci10],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// English 6–10
	// ---------------------------------------------------------------------------
	{
		id: "english-6-10-grade-9-with-writing",
		description:
			"Grade 9 English including a long_answer writing task — verifies literary-voice guard, both worked examples (Road Not Taken + letter to editor), and writing-skills format rule.",
		subject: "english-6-10",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 4,
					fill_in_blank: 3,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "English",
				subjectGrade: 9,
				subjectGroup: "English",
				studentGrade: 9,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE English examiner" },
			{ type: "contains", substring: "Beehive" },
			{ type: "mentionsGrade", grade: 9 },
			{ type: "contains", substring: "Distinguish the speaker from the poet", label: "literary-voice guard" },
			{ type: "contains", substring: "The Road Not Taken", label: "literature exemplar" },
			{ type: "contains", substring: "Letter to the Editor", label: "writing-skills exemplar (P1/#7)" },
			{ type: "contains", substring: "format" },
			{ type: "contains", substring: "audience" },
			{ type: "contains", substring: "word count" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.english9],
			},
			{ type: "noEmptyQuestions" },
		],
	},

	// ---------------------------------------------------------------------------
	// English 11–12
	// ---------------------------------------------------------------------------
	{
		id: "english-11-12-grade-12-with-article",
		description:
			"Grade 12 English Core — verifies Hornbill/Flamingo persona, technical-term-without-gloss rule, both worked examples (Kamala Das poem + article task).",
		subject: "english-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 5,
					fill_in_blank: 2,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "English Core",
				subjectGrade: 12,
				subjectGroup: "English",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE English board examiner" },
			{ type: "contains", substring: "Hornbill" },
			{ type: "contains", substring: "Flamingo" },
			{ type: "mentionsGrade", grade: 12 },
			{ type: "contains", substring: "without gloss" },
			{ type: "contains", substring: "My Mother at Sixty-Six", label: "literature exemplar" },
			{ type: "contains", substring: "Article (180–200 words)", label: "writing-skills exemplar (P1/#7)" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.english12],
			},
			{ type: "noEmptyQuestions" },
		],
	},

	// ---------------------------------------------------------------------------
	// Physics 11–12
	// ---------------------------------------------------------------------------
	{
		id: "physics-11-12-grade-12-with-derivation",
		description:
			"Grade 12 Physics — verifies SI constants, sign-convention rule, both worked examples (lens formula MCQ + capacitor derivation).",
		subject: "physics-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 5,
					fill_in_blank: 2,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Physics Part 2",
				subjectGrade: 12,
				subjectGroup: "Physics",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Physics examiner" },
			{ type: "mentionsGrade", grade: 12 },
			{ type: "contains", substring: "Sign conventions are the primary distractor source", label: "load-bearing rule" },
			{ type: "contains", substring: "g = 9.8 m/s²", label: "SI constants inline" },
			{ type: "contains", substring: "Lens Formula and Sign Convention", label: "MCQ exemplar" },
			{ type: "contains", substring: "Parallel-Plate Capacitor", label: "derivation exemplar (P1/#7)" },
			{ type: "contains", substring: "F⃗", label: "vector arrow notation" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.physics12],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Chemistry 11–12
	// ---------------------------------------------------------------------------
	{
		id: "chemistry-11-12-grade-12-with-conversion",
		description:
			"Grade 12 Chemistry — verifies three-sub-disciplines rule, verification rule, both worked examples (Markovnikov MCQ + ethanol→ethanoic-acid conversion).",
		subject: "chemistry-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 5,
					fill_in_blank: 2,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Chemistry Part 2",
				subjectGrade: 12,
				subjectGroup: "Chemistry",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Chemistry examiner" },
			{ type: "contains", substring: "Verify the chemistry before emitting", label: "load-bearing verification rule" },
			{ type: "contains", substring: "R = 8.314 J/mol·K", label: "constants inline" },
			{ type: "contains", substring: "Markovnikov / Peroxide Effect", label: "MCQ exemplar" },
			{ type: "contains", substring: "Convert ethanol", label: "organic-conversion exemplar (P1/#7)" },
			{ type: "contains", substring: "→" },
			{ type: "contains", substring: "⇌" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.chemistry12],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Biology 11–12
	// ---------------------------------------------------------------------------
	{
		id: "biology-11-12-grade-12-with-dihybrid",
		description:
			"Grade 12 Biology — verifies the load-bearing hallucination guard, genetic notation, both worked examples (X-linked MCQ + dihybrid cross).",
		subject: "biology-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 5,
					fill_in_blank: 2,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Biology Part 2",
				subjectGrade: 12,
				subjectGroup: "Biology",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Biology examiner" },
			{ type: "contains", substring: "LLMs frequently hallucinate scientist–discovery attributions", label: "load-bearing hallucination guard" },
			{ type: "contains", substring: "X-linked Recessive", label: "MCQ exemplar" },
			{ type: "contains", substring: "Dihybrid Cross", label: "long_answer exemplar (P1/#7)" },
			{ type: "contains", substring: "9 : 3 : 3 : 1" },
			{ type: "contains", substring: "TT × tt → Tt", label: "genetic-notation convention" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.biology12],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Accountancy 11–12
	// ---------------------------------------------------------------------------
	{
		id: "accountancy-11-12-grade-11-format-compliance",
		description:
			"Grade 11 Accountancy — verifies inline markdown-table exemplars (the load-bearing distinction for this subject) and Indian-numbering convention.",
		subject: "accountancy-11-12",
		input: {
			userMessageSummary: makeSummary(),
			generationSubject: {
				subjectName: "Accountancy",
				subjectGrade: 11,
				subjectGroup: "Accountancy",
				studentGrade: 11,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT Accountancy examiner" },
			{ type: "mentionsGrade", grade: 11 },
			{ type: "contains", substring: "Format conventions are non-negotiable", label: "load-bearing rule" },
			// Markdown-table exemplars are the signature feature
			{
				type: "contains",
				substring: "| Date | Particulars | L.F. | Debit (₹) | Credit (₹) |",
				label: "journal-entry table exemplar",
			},
			{
				type: "contains",
				substring: "| Dr | Particulars | ₹ | Cr | Particulars | ₹ |",
				label: "T-account table exemplar",
			},
			{ type: "contains", substring: "₹1,00,000" },
			{ type: "contains", substring: "Sharma Industries", label: "worked example" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.accountancy11],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},

	// ---------------------------------------------------------------------------
	// Business Studies 11–12
	// ---------------------------------------------------------------------------
	{
		id: "business-studies-11-12-grade-12-application-first",
		description:
			"Grade 12 Business Studies — verifies application-first rule, statutes guard, both worked examples (Fayol scenario MCQ + multi-part case-based).",
		subject: "business-studies-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 4,
					fill_in_blank: 2,
					short_answer: 4,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Business Studies",
				subjectGrade: 12,
				subjectGroup: "Business Studies",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Business Studies examiner" },
			{ type: "contains", substring: "Application is everything", label: "load-bearing rule" },
			{ type: "contains", substring: "Don't invent specific section numbers", label: "statutes guard" },
			{ type: "contains", substring: "Patel Engineering Ltd.", label: "scenario MCQ exemplar" },
			{ type: "contains", substring: "Patel & Sons", label: "case-based long_answer exemplar (P1/#7)" },
			{ type: "contains", substring: "Unity of Command vs Unity of Direction" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.bst12],
			},
			{ type: "noEmptyQuestions" },
		],
	},

	// ---------------------------------------------------------------------------
	// Economics 11–12
	// ---------------------------------------------------------------------------
	{
		id: "economics-11-12-grade-12-with-statistics",
		description:
			"Grade 12 Economics — verifies four-sub-disciplines rule, policy-year hallucination guard, both worked examples (Demand MCQ + frequency distribution).",
		subject: "economics-11-12",
		input: {
			userMessageSummary: makeSummary({
				question_type_counts: {
					multiple_choice: 5,
					fill_in_blank: 2,
					short_answer: 3,
					long_answer: 2,
				},
			}),
			generationSubject: {
				subjectName: "Economics",
				subjectGrade: 12,
				subjectGroup: "Economics",
				studentGrade: 12,
			},
		},
		promptAssertions: [
			{ type: "contains", substring: "NCERT/CBSE Economics examiner" },
			{ type: "contains", substring: "Statistics for Economics" },
			{ type: "contains", substring: "Indian Economic Development" },
			{ type: "contains", substring: "Never produce specific GDP figures", label: "load-bearing policy-year guard" },
			{ type: "contains", substring: "Demand: Movement vs Shift", label: "MCQ exemplar" },
			{ type: "contains", substring: "Arithmetic Mean of a Frequency Distribution", label: "long_answer exemplar (P1/#7)" },
			{ type: "contains", substring: "Σ" },
			{ type: "contains", substring: "x̄" },
		],
		outputAssertions: [
			{ type: "totalCountMatches" },
			{ type: "perBucketCountsMatch" },
			{
				type: "topicIdsFromList",
				allowedTopicIds: [TOPICS.economics12],
			},
			{ type: "noEmptyQuestions" },
			{ type: "mcqOptionsParity" },
		],
	},
];

/** Re-export individual subjects for selective runs. */
export const FIXTURES_BY_SUBJECT: Record<string, PracticeFixture[]> = FIXTURES.reduce(
	(acc, f) => {
		(acc[f.subject] ??= []).push(f);
		return acc;
	},
	{} as Record<string, PracticeFixture[]>,
);
