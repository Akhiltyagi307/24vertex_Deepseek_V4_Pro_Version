import { describe, expect, it } from "vitest";

import {
	buildPracticeUserMessage,
	stringifyPracticeUserMessage,
	stringifyPracticeUserMessageForModel,
	toPracticeUserMessageForModel,
} from "../user-message";

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
			subject: { id: "33333333-3333-4333-8333-333333333333", name: "Physics" },
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
		expect(msg.schema_version).toBe(3);
		expect(msg.topic_grounding).toHaveLength(2);
		expect(msg.topic_grounding[0]!.content_chunks).toEqual([]);
		expect(msg.test_parameters.estimated_question_count).toBe(15);
		expect(msg.test_parameters.generation_instruction.length).toBeGreaterThan(20);
		expect(msg.grounding_meta.topic_count).toBe(2);
		expect(msg.topics[0]).toEqual({
			topic_id: TOPICS[0]!.topicId,
			performance: {
				status: TOPICS[0]!.status,
				average_score_percent: TOPICS[0]!.averageScore,
				tests_taken: TOPICS[0]!.testsTaken,
				trend: TOPICS[0]!.trend,
				last_test_date: TOPICS[0]!.lastTestDate,
			},
		});
	});

	it("collapses to all-MCQ for Mathematics subjects (1 hour)", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "33333333-3333-4333-8333-333333333333", name: "Mathematics" },
			difficulty: "medium",
			timeLimitSeconds: 3600,
			topics: TOPICS,
		});
		expect(msg.test_parameters.estimated_question_count).toBe(15);
		expect(msg.test_parameters.question_type_counts).toEqual({
			multiple_choice: 15,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		});
	});

	it("collapses to all-MCQ for Mathematics subjects (3 hours)", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 11,
			subject: { id: "44444444-4444-4444-8444-444444444444", name: "Applied Mathematics" },
			difficulty: "hard",
			timeLimitSeconds: 10800,
			topics: TOPICS,
		});
		expect(msg.test_parameters.estimated_question_count).toBe(30);
		expect(msg.test_parameters.question_type_counts).toEqual({
			multiple_choice: 30,
			fill_in_blank: 0,
			short_answer: 0,
			long_answer: 0,
		});
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
		expect(json).toContain("\"schema_version\": 3");
	});

	it("strips fetch_error from model-facing JSON", () => {
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "x", name: "S" },
			difficulty: "medium",
			timeLimitSeconds: 3600,
			topics: TOPICS,
			preFetchedTopicContext: {
				byTopic: new Map(),
				meta: {
					topic_count: 2,
					context_chunk_count: 0,
					exercise_chunk_count: 0,
					context_char_total: 0,
					exercise_char_total: 0,
					truncated: false,
					fetch_error: "query_failed",
				},
			},
		});
		const forModel = toPracticeUserMessageForModel(msg);
		expect("fetch_error" in forModel.grounding_meta).toBe(false);
		const json = stringifyPracticeUserMessageForModel(msg);
		expect(json).not.toContain("fetch_error");
	});
});
