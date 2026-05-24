import { describe, expect, it } from "vitest";

import {
	buildPracticeGradingSystemPrompt,
	buildPracticeGradingUserPrompt,
} from "@/lib/practice/grading-prompts";
import type { GradingQuestionInput } from "@/lib/practice/grading-prompts";

const sampleQuestion: GradingQuestionInput = {
	question_id: "00000000-0000-4000-8000-000000000001",
	topic_id: "00000000-0000-4000-8000-000000000002",
	topic_name: "Algebra",
	question_number: 3,
	question_type: "short_answer",
	question_text: "Define a function.",
	question_difficulty: "easy",
	options: null,
	answer_key: {
		correct_answer: "A relation...",
		common_mistakes: ["Confusing domain and range"],
		marking_points: ["States input-output idea"],
	},
	student_answer_raw: { kind: "text", value: "maps x to y" },
	student_answer_text: "maps x to y",
};

describe("grading-prompts", () => {
	it("includes practice tone and breakdown field instructions", () => {
		const system = buildPracticeGradingSystemPrompt({
			subjectName: "Mathematics",
			requireMathSteps: true,
		});
		expect(system).toContain("PRACTICE GRADER TONE");
		expect(system).toContain("what_was_correct");
		expect(system).toContain("where_marks_were_lost");
		expect(system).toContain("to_reach_next_band");
		expect(system).toContain("HIGHER band");
	});

	it("includes grader brief with marking points in user prompt", () => {
		const user = buildPracticeGradingUserPrompt("part 1 of 1", [sampleQuestion]);
		expect(user).toContain("Grader brief:");
		expect(user).toContain("Marking points:");
		expect(user).toContain("States input-output idea");
		expect(user).toContain("Common mistakes");
	});
});
