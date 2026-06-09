import { describe, expect, it } from "vitest";

import {
	deriveManualConfig,
	manualDraftToQuestionInput,
	storedQuestionToDraft,
	summarizeNotStartedImpact,
} from "@/lib/assignments/manual-helpers";
import type { ManualQuestionInput } from "@/lib/assignments/manual-schemas";

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";

const questions: ManualQuestionInput[] = [
	{ question_type: "short_answer", topic_id: T1, question_text: "a", difficulty_level: "medium", answer_key: { marking_points: ["x"] } },
	{ question_type: "short_answer", topic_id: T2, question_text: "b", difficulty_level: "medium", answer_key: { marking_points: ["y"] } },
	{ question_type: "short_answer", topic_id: T1, question_text: "c", difficulty_level: "medium", answer_key: { marking_points: ["z"] } },
];

describe("deriveManualConfig", () => {
	it("derives distinct topic_ids and question_count from authored questions", () => {
		const config = deriveManualConfig({
			subjectId: "55555555-5555-5555-5555-555555555555",
			difficulty: "easy",
			timeLimitSeconds: 1800,
			questions,
		});
		expect(config.authoring_mode).toBe("manual");
		expect(config.question_count).toBe(3);
		expect([...config.topic_ids].sort()).toEqual([T1, T2].sort());
		expect(config.time_limit_seconds).toBe(1800);
	});
});

describe("summarizeNotStartedImpact", () => {
	it("counts not-started vs frozen submissions", () => {
		const out = summarizeNotStartedImpact({
			pending_materialize: 1,
			ready: 2,
			failed_generation: 1,
			in_progress: 3,
			submitted: 1,
			grading: 0,
			graded: 4,
			late: 0,
			excused: 0,
		});
		expect(out.appliedToNotStarted).toBe(4);
		expect(out.skippedAlreadyStarted).toBe(8);
	});
});

describe("manualDraftToQuestionInput", () => {
	it("maps an MCQ draft to letter-keyed options and a letter answer", () => {
		const out = manualDraftToQuestionInput({
			id: "x",
			questionType: "multiple_choice",
			topicId: T1,
			questionText: "2+2?",
			difficultyLevel: "medium",
			options: ["3", "4", ""],
			correctIndex: 1,
			correctAnswer: "",
			acceptableVariants: "",
			tolerance: "",
			units: "",
			modelAnswer: "",
			markingPoints: "",
		});
		expect(out).toEqual({
			question_type: "multiple_choice",
			topic_id: T1,
			question_text: "2+2?",
			difficulty_level: "medium",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "B" },
		});
	});

	it("compacts a gap in MCQ options and remaps the correct letter", () => {
		// Teacher fills A and C but leaves B blank, with C (index 2) marked correct.
		const out = manualDraftToQuestionInput({
			id: "z",
			questionType: "multiple_choice",
			topicId: T1,
			questionText: "Pick one",
			difficultyLevel: "medium",
			options: ["first", "", "third"],
			correctIndex: 2,
			correctAnswer: "",
			acceptableVariants: "",
			tolerance: "",
			units: "",
			modelAnswer: "",
			markingPoints: "",
		});
		expect(out).toEqual({
			question_type: "multiple_choice",
			topic_id: T1,
			question_text: "Pick one",
			difficulty_level: "medium",
			options: { A: "first", B: "third" },
			answer_key: { correct_answer: "B" },
		});
	});

	it("maps an open-ended draft's marking points from newlines", () => {
		const out = manualDraftToQuestionInput({
			id: "y",
			questionType: "short_answer",
			topicId: T1,
			questionText: "Define inertia.",
			difficultyLevel: "easy",
			options: [],
			correctIndex: 0,
			correctAnswer: "",
			acceptableVariants: "",
			tolerance: "",
			units: "",
			modelAnswer: "A body resists change in motion.",
			markingPoints: "Mentions resistance\nLinks to mass",
		});
		expect(out.answer_key).toMatchObject({
			model_answer: "A body resists change in motion.",
			marking_points: ["Mentions resistance", "Links to mass"],
		});
	});
});

describe("storedQuestionToDraft", () => {
	it("rebuilds an MCQ draft from stored options + letter answer", () => {
		const draft = storedQuestionToDraft(
			{
				questionType: "multiple_choice",
				topicId: T1,
				questionText: "2+2?",
				options: { A: "3", B: "4" },
				answerKey: { correct_answer: "B" },
				difficultyLevel: "medium",
			},
			"q-0",
		);
		expect(draft.questionType).toBe("multiple_choice");
		expect(draft.options).toEqual(["3", "4"]);
		expect(draft.correctIndex).toBe(1);
		expect(draft.topicId).toBe(T1);
	});

	it("rebuilds an open-ended draft (model answer + newline-joined marking points)", () => {
		const draft = storedQuestionToDraft(
			{
				questionType: "short_answer",
				topicId: T1,
				questionText: "Define inertia.",
				options: null,
				answerKey: { model_answer: "Resists change", marking_points: ["a", "b"] },
				difficultyLevel: "easy",
			},
			"q-1",
		);
		expect(draft.difficultyLevel).toBe("easy");
		expect(draft.modelAnswer).toBe("Resists change");
		expect(draft.markingPoints).toBe("a\nb");
	});

	it("round-trips through manualDraftToQuestionInput", () => {
		const draft = storedQuestionToDraft(
			{
				questionType: "multiple_choice",
				topicId: T1,
				questionText: "2+2?",
				options: { A: "3", B: "4" },
				answerKey: { correct_answer: "B" },
				difficultyLevel: "medium",
			},
			"q-0",
		);
		expect(manualDraftToQuestionInput(draft)).toEqual({
			question_type: "multiple_choice",
			topic_id: T1,
			question_text: "2+2?",
			difficulty_level: "medium",
			options: { A: "3", B: "4" },
			answer_key: { correct_answer: "B" },
		});
	});
});
