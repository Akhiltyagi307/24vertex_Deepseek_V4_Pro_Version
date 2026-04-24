import { describe, expect, it } from "vitest";

import { buildPracticeUserMessage, stringifyPracticeUserMessage } from "../user-message";

const TOPICS = [
	{
		trackerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		topicId: "11111111-1111-4111-8111-111111111111",
		topicName: "Topic A",
		unitName: "Unit 1",
		chapterName: "Chapter 1",
		grade: 9,
		status: "bad",
		averageScore: 42,
		testsTaken: 3,
		trend: "declining",
		lastTestDate: "2026-04-01T00:00:00Z",
	},
	{
		trackerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		topicId: "22222222-2222-4222-8222-222222222222",
		topicName: "Topic B",
		unitName: "Unit 1",
		chapterName: "Chapter 2",
		grade: 9,
		status: "satisfactory",
		averageScore: 65,
		testsTaken: 2,
		trend: "stable",
		lastTestDate: null,
	},
];

function manyTopics(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		...TOPICS[i % 2]!,
		trackerId: `00000000-0000-4000-8001-${i.toString(16).padStart(12, "0")}`,
		topicId: `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
		topicName: `Topic ${i}`,
	}));
}

describe("buildPracticeUserMessage", () => {
	it("derives question counts from duration (1 hour)", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "33333333-3333-4333-8333-333333333333", name: "Mathematics" },
			difficulty: "medium",
			timeLimitSeconds: 3600,
			topics: TOPICS,
		});
		expect(msg.test_parameters.estimated_question_count).toBe(15);
		expect(msg.test_parameters.question_type_counts).toEqual({
			multiple_choice: 5,
			fill_in_blank: 5,
			short_answer: 3,
			long_answer: 2,
		});
		expect(msg.test_parameters.note).toContain("questions_by_type");
		expect(msg.topics.length).toBe(2);
	});

	it("picks the correct coverage mode", () => {
		const few = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "x", name: "S" },
			difficulty: "easy",
			timeLimitSeconds: 3600,
			topics: TOPICS,
		});
		expect(few.test_parameters.coverage_mode).toBe("few_topics");

		const many = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "x", name: "S" },
			difficulty: "easy",
			timeLimitSeconds: 10800,
			topics: manyTopics(40),
		});
		expect(many.test_parameters.coverage_mode).toBe("many_topics");
	});

	it("includes recent_errors when present", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "x", name: "S" },
			difficulty: "medium",
			timeLimitSeconds: 3600,
			topics: TOPICS,
			recentErrors: [
				{
					topic_id: TOPICS[0]!.topicId,
					topic_name: TOPICS[0]!.topicName,
					concept: "Forgot to distribute the negative",
					verdict: "incorrect",
					last_seen_at: "2026-04-10T00:00:00Z",
				},
			],
		});
		expect(msg.student.recent_errors?.length).toBe(1);
	});

	it("produces stable JSON output shape", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "x", name: "S" },
			difficulty: "hard",
			timeLimitSeconds: 10800,
			topics: TOPICS,
		});
		const json = stringifyPracticeUserMessage(msg);
		expect(json).toContain("\"intent\": \"generate_practice_test\"");
		expect(json).toContain("\"schema_version\": 1");
	});
});
