import { describe, expect, it } from "vitest";

import {
	createPracticeGenerationOutputSchema,
	flattenPracticeGenerationOutput,
	normalizeGroupedEstimatedTimesToPlan,
	practiceGenerationOutputSchema,
	summarizeGroupedQuestionTypeCounts,
	sumGroupedEstimatedSeconds,
	validateAndStripGeneration,
	type PracticeGenerationGroupedOutput,
	type PracticeGenerationOutput,
} from "../generation-schema";
import { getPracticeQuestionPlan } from "../constants";

const shortAnswerKey = {
	correct_answer: "4",
	explanation: "Because.",
	common_mistakes: [],
	related_concept: "x",
};

function makeQuestion(overrides: Partial<PracticeGenerationOutput["questions"][number]> = {}) {
	return {
		question_number: 1,
		topic_id: "11111111-1111-4111-8111-111111111111",
		topic_name: "Topic A",
		question_text: "What is 2 + 2?",
		question_type: "multiple_choice" as const,
		difficulty_level: "easy" as const,
		options: { A: "3", B: "4", C: "5", D: "22" },
		answer_key: {
			correct_answer: "B",
			explanation: "2+2=4.",
			common_mistakes: [],
			related_concept: "Addition",
		},
		estimated_time_seconds: 240,
		visual: null,
		...overrides,
	};
}

function makeDraftQuestion(
	overrides: Partial<PracticeGenerationGroupedOutput["questions_by_type"]["multiple_choice"][number]> = {},
) {
	return {
		topic_id: "11111111-1111-4111-8111-111111111111",
		topic_name: "Topic A",
		question_text: "Draft question",
		difficulty_level: "easy" as const,
		options: { A: "3", B: "4", C: "5", D: "22" },
		answer_key: {
			correct_answer: "B",
			explanation: "2+2=4.",
			common_mistakes: [],
			related_concept: "Addition",
		},
		estimated_time_seconds: 240,
		visual: null,
		...overrides,
	};
}

const TOPIC_A = "11111111-1111-4111-8111-111111111111";
const TOPIC_B = "22222222-2222-4222-8222-222222222222";

function makeGeneration(questions: PracticeGenerationOutput["questions"]): PracticeGenerationOutput {
	return {
		questions,
		generation_metadata: {
			topic_distribution: {},
			difficulty_distribution: { easy: 0, medium: 0, hard: 0 },
			type_distribution: {
				multiple_choice: 0,
				fill_in_blank: 0,
				short_answer: 0,
				long_answer: 0,
			},
			adaptation_rationale: "",
		},
	};
}

function makeGroupedGeneration(
	counts = getPracticeQuestionPlan(3600).counts,
): PracticeGenerationGroupedOutput {
	return {
		questions_by_type: {
			multiple_choice: Array.from({ length: counts.multiple_choice }, (_, i) =>
				makeDraftQuestion({
					question_text: `MCQ ${i + 1}`,
					topic_id: i % 2 === 0 ? TOPIC_A : TOPIC_B,
					topic_name: i % 2 === 0 ? "Topic A" : "Topic B",
				}),
			),
			fill_in_blank: Array.from({ length: counts.fill_in_blank }, (_, i) => ({
				...makeDraftQuestion({
					question_text: `Blank ${i + 1}`,
					options: { A: "unused", B: "unused", C: "unused", D: "unused" },
				}),
				options: null,
			})),
			short_answer: Array.from({ length: counts.short_answer }, (_, i) => ({
				...makeDraftQuestion({
					question_text: `Short ${i + 1}`,
					options: { A: "unused", B: "unused", C: "unused", D: "unused" },
				}),
				options: null,
			})),
			long_answer: Array.from({ length: counts.long_answer }, (_, i) => ({
				...makeDraftQuestion({
					question_text: `Long ${i + 1}`,
					options: { A: "unused", B: "unused", C: "unused", D: "unused" },
				}),
				options: null,
			})),
		},
		generation_metadata: {
			adaptation_rationale: "Favor weaker topics first.",
		},
	};
}

describe("practiceGenerationOutputSchema", () => {
	it("accepts a minimal valid generation", () => {
		const raw = makeGeneration([makeQuestion()]);
		expect(practiceGenerationOutputSchema.safeParse(raw).success).toBe(true);
	});
});

describe("createPracticeGenerationOutputSchema", () => {
	it("accepts grouped output that matches the 1-hour plan exactly", () => {
		const plan = getPracticeQuestionPlan(3600);
		const raw = makeGroupedGeneration(plan.counts);
		expect(createPracticeGenerationOutputSchema(plan.counts).safeParse(raw).success).toBe(true);
		expect(summarizeGroupedQuestionTypeCounts(raw)).toEqual(plan.counts);
	});

	it("requires explicit options: null for written buckets", () => {
		const plan = getPracticeQuestionPlan(3600);
		const raw = makeGroupedGeneration(plan.counts);
		if (raw.questions_by_type.fill_in_blank[0]) {
			delete (raw.questions_by_type.fill_in_blank[0] as { options?: null }).options;
		}
		const parsed = createPracticeGenerationOutputSchema(plan.counts).safeParse(raw);
		expect(parsed.success).toBe(false);
	});

	it("rejects grouped output when a bucket length is wrong", () => {
		const plan = getPracticeQuestionPlan(3600);
		const raw = makeGroupedGeneration(plan.counts);
		raw.questions_by_type.multiple_choice.pop();
		const parsed = createPracticeGenerationOutputSchema(plan.counts).safeParse(raw);
		expect(parsed.success).toBe(false);
	});
});

describe("flattenPracticeGenerationOutput", () => {
	it("flattens grouped output into the exact expected type mix", () => {
		const plan = getPracticeQuestionPlan(3600);
		const raw = makeGroupedGeneration(plan.counts);
		const flat = flattenPracticeGenerationOutput(raw);
		expect(flat.questions).toHaveLength(plan.total);
		expect(flat.questions[0]?.question_number).toBe(1);
		expect(flat.questions.at(-1)?.question_number).toBe(plan.total);
		const out = validateAndStripGeneration(flat, plan.total, new Set([TOPIC_A, TOPIC_B]), {
			expectedTypeCounts: plan.counts,
			expectedDurationSeconds: 3600,
		});
		if (!out.ok) {
			throw new Error(out.message);
		}
		if (!out.ok) return;
		expect(out.generation_metadata.type_distribution).toEqual(plan.counts);
	});

	it("supports the 3-hour plan end-to-end", () => {
		const plan = getPracticeQuestionPlan(10800);
		const raw = makeGroupedGeneration(plan.counts);
		const flat = flattenPracticeGenerationOutput(raw);
		const out = validateAndStripGeneration(flat, plan.total, new Set([TOPIC_A, TOPIC_B]), {
			expectedTypeCounts: plan.counts,
		});
		expect(out.ok).toBe(true);
	});
});

describe("validateAndStripGeneration - MCQ validation", () => {
	it("rejects when MCQ correct_answer is not a valid option letter", () => {
		const raw = makeGeneration([
			makeQuestion({ answer_key: { ...makeQuestion().answer_key, correct_answer: "option B" } }),
			makeQuestion({
				question_number: 2,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]));
		expect(out.ok).toBe(false);
	});

	it("accepts single-letter A-D and normalizes casing", () => {
		const raw = makeGeneration([
			makeQuestion({ answer_key: { ...makeQuestion().answer_key, correct_answer: "b" } }),
			makeQuestion({
				question_number: 2,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]));
		expect(out.ok).toBe(true);
		expect(raw.questions[0]!.answer_key.correct_answer).toBe("B");
	});

	it("rejects MCQ missing options A-D", () => {
		const raw = makeGeneration([
			makeQuestion({ options: { A: "1", B: "2", C: "3" } }),
			makeQuestion({
				question_number: 2,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]));
		expect(out.ok).toBe(false);
	});
});

describe("validateAndStripGeneration - type mix + time budget", () => {
	it("rejects when a type count does not match exactly", () => {
		const raw = makeGeneration([
			makeQuestion({ question_number: 1 }),
			makeQuestion({ question_number: 2 }),
			makeQuestion({ question_number: 3 }),
			makeQuestion({
				question_number: 4,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 4, new Set([TOPIC_A]), {
			expectedTypeCounts: {
				multiple_choice: 1,
				fill_in_blank: 1,
				short_answer: 1,
				long_answer: 1,
			},
		});
		expect(out.ok).toBe(false);
	});

	it("rejects when time budget is wildly off", () => {
		const raw = makeGeneration([
			makeQuestion({ question_number: 1, estimated_time_seconds: 10 }),
			makeQuestion({
				question_number: 2,
				estimated_time_seconds: 10,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]), {
			expectedDurationSeconds: 600,
		});
		expect(out.ok).toBe(false);
	});

	it("recomputes topic_distribution instead of trusting the model's claim", () => {
		const raw = makeGeneration([
			makeQuestion({ question_number: 1, topic_id: TOPIC_A }),
			makeQuestion({
				question_number: 2,
				topic_id: TOPIC_B,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		raw.generation_metadata.topic_distribution = {
			[TOPIC_A]: 2,
			[TOPIC_B]: 0,
		};
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A, TOPIC_B]));
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.generation_metadata.topic_distribution[TOPIC_A]).toBe(1);
		expect(out.generation_metadata.topic_distribution[TOPIC_B]).toBe(1);
	});

	it("rejects topics outside the allowed set", () => {
		const raw = makeGeneration([
			makeQuestion({ question_number: 1, topic_id: TOPIC_A }),
			makeQuestion({
				question_number: 2,
				topic_id: "33333333-3333-4333-8333-333333333333",
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]));
		expect(out.ok).toBe(false);
	});

	it("accepts topic_id with different UUID letter casing and normalizes to the allowed form", () => {
		const raw = makeGeneration([
			makeQuestion({ question_number: 1, topic_id: TOPIC_A.toUpperCase() }),
			makeQuestion({
				question_number: 2,
				topic_id: TOPIC_B,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A, TOPIC_B]));
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.questions[0].topic_id).toBe(TOPIC_A);
		expect(out.questions[1].topic_id).toBe(TOPIC_B);
	});
});

describe("normalizeGroupedEstimatedTimesToPlan", () => {
	it("leaves sums already inside the validator band unchanged", () => {
		const grouped = makeGroupedGeneration(getPracticeQuestionPlan(3600).counts);
		const before = sumGroupedEstimatedSeconds(grouped);
		const out = normalizeGroupedEstimatedTimesToPlan(grouped, 3600);
		expect(sumGroupedEstimatedSeconds(out)).toBe(before);
	});

	it("scales down when total time exceeds the high bound", () => {
		const counts = getPracticeQuestionPlan(10800).counts;
		const grouped = makeGroupedGeneration(counts);
		for (const q of grouped.questions_by_type.multiple_choice) {
			q.estimated_time_seconds = 900;
		}
		for (const q of grouped.questions_by_type.fill_in_blank) {
			q.estimated_time_seconds = 900;
		}
		for (const q of grouped.questions_by_type.short_answer) {
			q.estimated_time_seconds = 900;
		}
		for (const q of grouped.questions_by_type.long_answer) {
			q.estimated_time_seconds = 900;
		}
		const out = normalizeGroupedEstimatedTimesToPlan(grouped, 10800);
		const sum = sumGroupedEstimatedSeconds(out);
		expect(sum).toBeLessThanOrEqual(Math.round(10800 * 1.2) + 30);
		expect(sum).toBeGreaterThanOrEqual(Math.round(10800 * 0.6) - 30);
	});
});

describe("validateAndStripGeneration - single-type plans (mathematics-style)", () => {
	it("accepts all MCQ when expectedTypeCounts asks for MCQ only", () => {
		const n = 5;
		const perQSeconds = 240;
		const questions = Array.from({ length: n }, (_, i) =>
			makeQuestion({
				question_number: i + 1,
				topic_id: TOPIC_A,
				question_type: "multiple_choice",
				options: { A: "1", B: "2", C: "3", D: "4" },
				answer_key: {
					correct_answer: "A",
					explanation: "x",
					common_mistakes: [],
					related_concept: "y",
				},
				estimated_time_seconds: perQSeconds,
			}),
		);
		const raw = makeGeneration(questions);
		const out = validateAndStripGeneration(raw, n, new Set([TOPIC_A]), {
			expectedTypeCounts: {
				multiple_choice: n,
				fill_in_blank: 0,
				short_answer: 0,
				long_answer: 0,
			},
			// 5 × 240s = 1200s must fall in [0.6T, 1.2T] ⇒ T = 2000 works.
			expectedDurationSeconds: 2000,
		});
		expect(out.ok).toBe(true);
	});

	it("rejects single produced type when the plan requires multiple types", () => {
		const raw = makeGeneration([
			makeQuestion({
				question_number: 1,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
			makeQuestion({
				question_number: 2,
				question_type: "short_answer",
				options: null,
				answer_key: shortAnswerKey,
			}),
		]);
		const out = validateAndStripGeneration(raw, 2, new Set([TOPIC_A]), {
			expectedTypeCounts: {
				multiple_choice: 1,
				fill_in_blank: 0,
				short_answer: 1,
				long_answer: 0,
			},
		});
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.message).toContain("two question types");
	});
});
