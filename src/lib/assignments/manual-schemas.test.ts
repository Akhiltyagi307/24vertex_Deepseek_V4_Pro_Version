import { describe, expect, it } from "vitest";

import { manualQuestionInputSchema, createManualAssignmentInputSchema } from "@/lib/assignments/manual-schemas";

const TOPIC = "22222222-2222-2222-2222-222222222222";

describe("manualQuestionInputSchema", () => {
	it("accepts an MCQ whose correct answer is a present option", () => {
		const parsed = manualQuestionInputSchema.parse({
			question_type: "multiple_choice",
			topic_id: TOPIC,
			question_text: "2 + 2 = ?",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "B" },
		});
		if (parsed.question_type === "multiple_choice") expect(parsed.answer_key.correct_answer).toBe("B");
	});

	it("rejects an MCQ whose correct answer is not among the options", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "multiple_choice",
			topic_id: TOPIC,
			question_text: "2 + 2 = ?",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "C" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects a numerical question whose answer is not numeric", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "numerical",
			topic_id: TOPIC,
			question_text: "Speed?",
			answer_key: { correct_answer: "fast" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects an open-ended question with no marking points or model answer", () => {
		const result = manualQuestionInputSchema.safeParse({
			question_type: "short_answer",
			topic_id: TOPIC,
			question_text: "Explain inertia.",
			answer_key: {},
		});
		expect(result.success).toBe(false);
	});

	it("accepts a long answer with marking points", () => {
		const parsed = manualQuestionInputSchema.parse({
			question_type: "long_answer",
			topic_id: TOPIC,
			question_text: "Discuss the causes of WW1.",
			answer_key: { marking_points: ["Alliances", "Militarism", "Assassination"] },
		});
		if (parsed.question_type === "long_answer") expect(parsed.answer_key.marking_points?.length).toBe(3);
	});
});

describe("createManualAssignmentInputSchema", () => {
	const base = {
		title: "Unit 1 quiz",
		instructions: null,
		subject_id: "11111111-1111-1111-1111-111111111111",
		difficulty: "medium",
		time_limit_seconds: 1800,
		student_ids: ["33333333-3333-3333-3333-333333333333"],
		due_at: null,
		questions: [
			{
				question_type: "multiple_choice",
				topic_id: TOPIC,
				question_text: "2 + 2 = ?",
				options: { A: "3", B: "4" },
				answer_key: { correct_answer: "B" },
			},
		],
	};

	it("accepts a valid manual assignment", () => {
		const parsed = createManualAssignmentInputSchema.parse(base);
		expect(parsed.questions).toHaveLength(1);
		expect(parsed.time_limit_seconds).toBe(1800);
	});

	it("requires at least one question", () => {
		const result = createManualAssignmentInputSchema.safeParse({ ...base, questions: [] });
		expect(result.success).toBe(false);
	});

	it("rejects a time limit outside bounds", () => {
		const result = createManualAssignmentInputSchema.safeParse({ ...base, time_limit_seconds: 60 });
		expect(result.success).toBe(false);
	});
});
