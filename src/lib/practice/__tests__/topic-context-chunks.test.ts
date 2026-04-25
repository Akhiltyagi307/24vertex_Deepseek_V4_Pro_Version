import { describe, expect, it } from "vitest";

import {
	applyTopicContextLimits,
	sortRawChunksByTopicThenCreated,
	TOPIC_CONTEXT_DEFAULT_LIMITS,
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
	it("splits by max chunks per topic", () => {
		const raw = new Map<string, { context: PracticeTopicChunkLine[]; exercise: PracticeTopicChunkLine[] }>();
		raw.set(T1, {
			context: Array.from({ length: 20 }, (_, i) => line(`c${i}`)),
			exercise: [],
		});
		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1], {
			...TOPIC_CONTEXT_DEFAULT_LIMITS,
			maxContextChunksPerTopic: 3,
			maxContextCharsPerTopic: 1_000_000,
		});
		expect(byTopic.get(T1)!.context).toHaveLength(3);
		expect(truncated).toBe(true);
	});

	it("enforces per-topic char budget", () => {
		const raw = new Map();
		raw.set(T1, {
			context: [line("ab"), line("cd"), line("ef")],
			exercise: [],
		});
		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1], {
			...TOPIC_CONTEXT_DEFAULT_LIMITS,
			maxContextChunksPerTopic: 10,
			maxContextCharsPerTopic: 3,
		});
		expect(byTopic.get(T1)!.context).toHaveLength(1);
		expect(truncated).toBe(true);
	});

	it("trims globally from last topic in order", () => {
		const raw = new Map();
		raw.set(T1, { context: [line("aaaa")], exercise: [] });
		raw.set(T2, { context: [line("bbbb")], exercise: [] });
		const { byTopic, truncated } = applyTopicContextLimits(raw, [T1, T2], {
			...TOPIC_CONTEXT_DEFAULT_LIMITS,
			maxContextChunksPerTopic: 5,
			maxContextCharsPerTopic: 10_000,
			maxTotalContextChars: 4,
		});
		expect(byTopic.get(T1)!.context).toHaveLength(1);
		expect(byTopic.get(T2)!.context).toHaveLength(0);
		expect(truncated).toBe(true);
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
				[T1, { context: [line("ctx1", "p.1")], exercise: [line("ex1", "q.2")] }],
			]),
			meta: {
				topic_count: 1,
				context_chunk_count: 1,
				exercise_chunk_count: 1,
				context_char_total: 4,
				exercise_char_total: 3,
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
		expect(msg.grounding_meta.context_chunk_count).toBe(1);
	});
});
