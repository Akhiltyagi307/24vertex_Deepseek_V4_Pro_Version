/**
 * Fixture types for the practice prompt eval/regression system.
 *
 * Two tiers of assertion:
 *   - Tier 1 ({@link PromptAssertion}) — structural assertions on the built
 *     system prompt, runnable in CI without an LLM call. Catches prompt-source
 *     drift (someone edits a builder and accidentally drops a load-bearing
 *     section, swaps a worked example, or breaks count interpolation).
 *   - Tier 2 ({@link OutputAssertion}) — behavioural assertions on the model's
 *     output for a given prompt + input. Runs only via the dedicated eval
 *     runner (`src/lib/practice/__evals__/runner.ts`); costs LLM calls.
 *
 * Each fixture captures one canonical scenario per subject. Happy-path
 * fixtures verify the migrated builder routes correctly and interpolates
 * counts; edge-case fixtures verify subject-specific guardrails fire.
 */

import type { PracticeGenerationSubjectContext } from "../system-prompt";
import type { PracticeUserMessageSummary } from "../user-message";

// ---------------------------------------------------------------------------
// Tier 1 — prompt-level assertions
// ---------------------------------------------------------------------------

export type PromptAssertion =
	| {
			type: "contains";
			/** Substring that must appear in the built prompt. */
			substring: string;
			/** Optional human label for failure reporting. */
			label?: string;
	  }
	| {
			type: "notContains";
			substring: string;
			label?: string;
	  }
	| {
			type: "matches";
			regex: RegExp;
			label?: string;
	  }
	| {
			type: "lengthBetween";
			min: number;
			max: number;
	  }
	| {
			/** Numeric `Total items = N.` interpolated correctly. */
			type: "interpolatesQuestionCount";
			expected: number;
	  }
	| {
			/** "Grade {n}" appears in the persona/calibration sections. */
			type: "mentionsGrade";
			grade: number;
	  };

export type PromptAssertionResult = {
	pass: boolean;
	assertion: PromptAssertion;
	reason?: string;
};

// ---------------------------------------------------------------------------
// Tier 2 — output-level assertions (LLM eval mode only)
// ---------------------------------------------------------------------------

/**
 * Shape of the model output we run output-assertions against. Keep it loose
 * so a partial / malformed response can still be evaluated (the schema check
 * is itself an assertion type).
 */
export type GeneratedQuestion = {
	topic_id?: string;
	topic_name?: string;
	question_text?: string;
	difficulty_level?: string;
	options?: Record<string, string>;
	answer_key?: {
		correct_answer?: string;
		explanation?: string;
		common_mistakes?: string[];
		related_concept?: string;
	};
	estimated_time_seconds?: number;
};

export type GeneratedOutput = {
	questions_by_type?: {
		multiple_choice?: GeneratedQuestion[];
		fill_in_blank?: GeneratedQuestion[];
		short_answer?: GeneratedQuestion[];
		long_answer?: GeneratedQuestion[];
	};
	generation_metadata?: {
		adaptation_rationale?: string;
	};
};

export type OutputAssertion =
	| {
			/** `questions_by_type` totals exactly `estimated_question_count`. */
			type: "totalCountMatches";
	  }
	| {
			/** Each bucket count exactly matches `question_type_counts.<bucket>`. */
			type: "perBucketCountsMatch";
	  }
	| {
			/** Every `topic_id` is in the supplied `topics[]` list. */
			type: "topicIdsFromList";
			/** Allowed topic_ids for this fixture. */
			allowedTopicIds: string[];
	  }
	| {
			/** Every question has non-empty `question_text` and an `answer_key`. */
			type: "noEmptyQuestions";
	  }
	| {
			/** Σ estimated_time_seconds within ±20% of test_parameters.time_limit_seconds. */
			type: "respectsTimeBudget";
			timeLimit: number;
	  }
	| {
			/** Output contains a non-empty `adaptation_rationale`. */
			type: "hasAdaptationRationale";
	  }
	| {
			/** At least one MCQ has all four options A/B/C/D, equal-ish length. */
			type: "mcqOptionsParity";
			/** Max allowed length difference (chars) between longest/shortest options. */
			maxLengthDelta?: number;
	  }
	| {
			/** Output text mentions a keyword (e.g. distractor anchor). */
			type: "outputMentions";
			keyword: string;
			/** Default 1: at least one occurrence across all question_text fields. */
			minOccurrences?: number;
	  };

export type OutputAssertionResult = {
	pass: boolean;
	assertion: OutputAssertion;
	reason?: string;
};

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export type PracticeFixture = {
	/** Stable kebab-case id, e.g. "math-6-10-grade-7-fractions-medium". */
	id: string;
	/** Human description of what this fixture exercises. */
	description: string;
	/** Subject category this fixture belongs to (used for grouping reports). */
	subject:
		| "math-6-10"
		| "math-11-12"
		| "science-6-10"
		| "social-science-6-10"
		| "english-6-10"
		| "english-11-12"
		| "physics-11-12"
		| "chemistry-11-12"
		| "biology-11-12"
		| "accountancy-11-12"
		| "business-studies-11-12"
		| "economics-11-12";
	/** Inputs fed to `buildPracticeSystemPrompt`. */
	input: {
		userMessageSummary: PracticeUserMessageSummary;
		generationSubject: PracticeGenerationSubjectContext;
	};
	/** Tier 1: structural assertions on the built system prompt. */
	promptAssertions: PromptAssertion[];
	/** Tier 2: behavioural assertions on the model's output (eval mode only). */
	outputAssertions: OutputAssertion[];
};
