import { describe, expect, it } from "vitest";

import {
	applyTopicContextLimits,
	sortRawChunksByTopicThenCreated,
	type RawTopicChunkRow,
} from "../topic-context-chunks";
import {
	buildPracticeUserMessage,
	type PracticeTopicChunkLine,
	type PreFetchedTopicContext,
} from "../user-message";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";

function line(text: string, source: string | null = null): PracticeTopicChunkLine {
	return { text, source_ref: source };
}

function fixedRandom(value: number): () => number {
	return () => value;
}

describe("sortRawChunksByTopicThenCreated", () => {
	it("orders by topicOrder then created_at ascending within a topic", () => {
		const tid = T1;
		const rows: RawTopicChunkRow[] = [
			{
				topic_id: tid,
				content: "second",
				chunk_type: "context",
				source_ref: null,
				created_at: "2026-01-02T00:00:00.000Z",
			},
			{
				topic_id: tid,
				content: "first",
				chunk_type: "context",
				source_ref: null,
				created_at: "2026-01-01T00:00:00.000Z",
			},
		];
		const sorted = sortRawChunksByTopicThenCreated(rows, [tid]);
		expect(sorted.map((r) => r.content)).toEqual(["first", "second"]);
	});
});

describe("applyTopicContextLimits", () => {
	it("includes all chunks without truncation", () => {
		const raw = new Map<
			string,
			{ context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[]; questionBank: PracticeTopicChunkLine[] }
		>();
		raw.set(T1, {
			context: Array.from({ length: 20 }, (_, i) => line(`c${i}`)),
			exercise: [line("ex0"), line("ex1")],
			questionBank: [line("qb0")],
		});
		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1]);
		expect(byTopic.get(T1)!.context).toHaveLength(20);
		expect(byTopic.get(T1)!.exercise).toHaveLength(2);
		expect(byTopic.get(T1)!.questionBank).toHaveLength(1);
		expect(truncated).toBe(false);
	});

	it("randomizes exercise and question-bank chunks while preserving context order", () => {
		const raw = new Map<
			string,
			{ context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[]; questionBank: PracticeTopicChunkLine[] }
		>();
		raw.set(T1, {
			context: [line("ctx0"), line("ctx1"), line("ctx2")],
			exercise: [line("ex0"), line("ex1"), line("ex2"), line("ex3")],
			questionBank: Array.from({ length: 7 }, (_, i) => line(`qb${i}`)),
		});

		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1], { random: fixedRandom(0) });

		const pack = byTopic.get(T1)!;
		expect(pack.context.map((c) => c.text)).toEqual(["ctx0", "ctx1", "ctx2"]);
		expect(pack.exercise.map((c) => c.text)).toEqual(["ex1", "ex2", "ex3", "ex0"]);
		expect(pack.questionBank.map((c) => c.text)).toEqual([
			"qb1",
			"qb2",
			"qb3",
			"qb4",
			"qb5",
			"qb6",
			"qb0",
		]);
		expect(truncated).toBe(false);
	});

	it("never drops chunks from later topics in the order", () => {
		const raw = new Map();
		raw.set(T1, { context: [line("aaaa")], exercise: [], questionBank: [] });
		raw.set(T2, { context: [line("bbbb")], exercise: [], questionBank: [] });
		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1, T2]);
		expect(byTopic.get(T1)!.context).toHaveLength(1);
		expect(byTopic.get(T2)!.context).toHaveLength(1);
		expect(truncated).toBe(false);
	});
});

describe("buildPracticeUserMessage with preFetchedTopicContext", () => {
	const baseTopics = [
		{
			trackerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			topicId: T1,
			topicName: "Topic A",
			unitName: "U1",
			chapterName: "C1",
			grade: 9,
			status: "good",
			averageScore: 80,
			testsTaken: 1,
			trend: "stable",
			lastTestDate: null,
		},
	];

	it("merges pre-fetched chunks by topic_id", () => {
		const pre: PreFetchedTopicContext = {
			byTopic: new Map([
				[
					T1,
					{
						context: [line("ctx1", "p.1")],
						exercise: [line("ex1", "q.2")],
						questionBank: [line("qb1", "bank.1")],
					},
				],
			]),
			meta: {
				topic_count: 1,
				context_chunk_count: 1,
				exercise_chunk_count: 1,
				question_bank_chunk_count: 1,
				context_char_total: 4,
				exercise_char_total: 3,
				question_bank_char_total: 3,
				truncated: false,
			},
		};
		const msg = buildPracticeUserMessage({
			studentGrade: 9,
			subject: { id: "s", name: "Science" },
			difficulty: "medium",
			timeLimitSeconds: 3600,
			topics: baseTopics,
			preFetchedTopicContext: pre,
		});
		expect(msg.topic_grounding[0]!.content_chunks).toEqual([{ text: "ctx1", source_ref: "p.1" }]);
		expect(msg.topic_grounding[0]!.exercise_chunks).toEqual([{ text: "ex1", source_ref: "q.2" }]);
		expect(msg.topic_grounding[0]!.question_bank_chunks).toEqual([{ text: "qb1", source_ref: "bank.1" }]);
		expect(msg.grounding_meta.context_chunk_count).toBe(1);
		expect(msg.grounding_meta.question_bank_chunk_count).toBe(1);
	});
});
