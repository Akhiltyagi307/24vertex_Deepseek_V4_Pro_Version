/** Minimum topics a student must select for a practice test configuration. */
export const PRACTICE_MIN_TOPICS = 1;

/**
 * Maximum topics a student may select in one test. Caps prompt size and
 * keeps generation focused — beyond ~20 topics the model spreads thin and
 * coverage degrades.
 */
export const PRACTICE_MAX_TOPICS = 20;

/** Self-practice: only 1 hour or 3 hours. */
export const PRACTICE_DURATION_OPTIONS = [
	{ label: "1 hour", seconds: 3600 as const },
	{ label: "3 hours", seconds: 10800 as const },
] as const;

export type PracticeDurationSeconds = (typeof PRACTICE_DURATION_OPTIONS)[number]["seconds"];

export const PRACTICE_DURATION_SECONDS_MIN = 3600;
export const PRACTICE_DURATION_SECONDS_MAX = 10800;

/** Fixed totals for self-practice (derived from duration only). */
export const PRACTICE_QUESTION_COUNT_MIN = 15;
export const PRACTICE_QUESTION_COUNT_MAX = 30;

/** Per-type counts for AI generation and validation (no numerical in new practice tests). */
export type PracticeQuestionTypeCounts = {
	multiple_choice: number;
	fill_in_blank: number;
	short_answer: number;
	long_answer: number;
};

export type PracticeQuestionPlan = {
	total: number;
	counts: PracticeQuestionTypeCounts;
};

/**
 * Single source of truth: duration → total questions and per-type counts.
 * @throws If duration is not a supported practice duration.
 */
export function getPracticeQuestionPlan(durationSeconds: number): PracticeQuestionPlan {
	if (durationSeconds === 3600) {
		return {
			total: 15,
			counts: {
				multiple_choice: 5,
				fill_in_blank: 5,
				short_answer: 3,
				long_answer: 2,
			},
		};
	}
	if (durationSeconds === 10800) {
		return {
			total: 30,
			counts: {
				multiple_choice: 10,
				fill_in_blank: 10,
				short_answer: 6,
				long_answer: 4,
			},
		};
	}
	throw new Error(`Unsupported practice duration: ${durationSeconds}`);
}

/** Stored on `tests.question_mix` for new self-practice tests (integer counts). */
export function practiceTypeCountsToQuestionMixJson(counts: PracticeQuestionTypeCounts): PracticeQuestionTypeCounts {
	return { ...counts };
}

/**
 * Mathematics subjects are graded as MCQ-only across all grades — open-ended
 * math grading is unreliable at scale and the curriculum exam pattern in
 * India is overwhelmingly MCQ-driven. Match by name substring (case-insensitive)
 * so "Mathematics", "Applied Mathematics", "Math (Standard)" all qualify.
 */
export function isMathematicsSubject(subjectName: string | null | undefined): boolean {
	if (!subjectName) return false;
	return /\bmath/i.test(subjectName);
}

/**
 * Subject-aware wrapper around {@link getPracticeQuestionPlan}. For Math
 * subjects, collapses the per-type counts to all multiple_choice while
 * preserving the duration-derived total.
 */
export function getPracticeQuestionPlanForSubject(
	durationSeconds: number,
	subjectName: string | null | undefined,
): PracticeQuestionPlan {
	const base = getPracticeQuestionPlan(durationSeconds);
	if (!isMathematicsSubject(subjectName)) return base;
	return {
		total: base.total,
		counts: {
			multiple_choice: base.total,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		},
	};
}
