import { describe, expect, it } from "vitest";

import { buildDoubtSystemPrompt } from "@/lib/ai/doubt-system-prompt";
import { groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import { parseStoredChapterMeta, type DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

const sampleScope: DoubtScopeSuccess = {
	ok: true,
	kind: "topic",
	userId: "u1",
	studentGrade: 9,
	subjectId: "s1",
	subjectName: "Mathematics",
	topic: {
		id: "t1",
		unitName: "Number Systems",
		unitNumber: 1,
		chapterName: "Real Numbers",
		chapterNumber: 1,
		topicName: "Irrational Numbers",
		topicNumber: 1,
		description: "Short description for tests.",
		learningObjectives: ["Identify irrational numbers", "Classify on the number line"],
	},
};

describe("buildDoubtSystemPrompt", () => {
	it("explain mode includes scope and EXPLAIN MODE", () => {
		const s = buildDoubtSystemPrompt(sampleScope, "explain");
		expect(s).toContain("Mathematics");
		expect(s).toContain("Irrational Numbers");
		expect(s).toContain("Grade 9");
		expect(s).toContain("Short description for tests.");
		expect(s).toContain("EXPLAIN MODE");
		expect(s).toContain("- Identify irrational numbers");
	});

	it("solve_with_me mode includes scope and SOLVE-WITH-ME MODE", () => {
		const s = buildDoubtSystemPrompt(sampleScope, "solve_with_me");
		expect(s).toContain("Mathematics");
		expect(s).toContain("Irrational Numbers");
		expect(s).toContain("Grade 9");
		expect(s).toContain("SOLVE-WITH-ME MODE");
		expect(s).toContain("Short description for tests.");
	});

	it("uses catalog fallbacks when description and objectives are empty", () => {
		const sparse: DoubtScopeSuccess = {
			...sampleScope,
			topic: {
				...sampleScope.topic,
				description: "   ",
				learningObjectives: [],
			},
		};
		const explain = buildDoubtSystemPrompt(sparse, "explain");
		expect(explain).toContain("(no description in catalog");
		expect(explain).toContain("(none listed)");
	});

	it("omits non-chunk metadata when contextChunksBlock is provided", () => {
		const chunkOnly: DoubtScopeSuccess = {
			...sampleScope,
			topic: {
				...sampleScope.topic,
				contextChunksBlock: "Chunk A.\n\nChunk B.",
			},
		};
		const s = buildDoubtSystemPrompt(chunkOnly, "explain");
		expect(s).toContain("Chunk A.");
		expect(s).toContain("Chunk B.");
		expect(s).toContain("Subject: not provided");
		expect(s).toContain("Grade not provided");
		expect(s).toContain("(omitted intentionally");
	});
});

describe("groupTopicRowsByChapter", () => {
	it("groups rows by unit+chapter and sorts topics", () => {
		const rows = [
			{
				id: "a",
				subjectId: "s",
				unitName: "U1",
				unitNumber: 1,
				chapterName: "C1",
				chapterNumber: 1,
				topicName: "T2",
				topicNumber: 2,
			},
			{
				id: "b",
				subjectId: "s",
				unitName: "U1",
				unitNumber: 1,
				chapterName: "C1",
				chapterNumber: 1,
				topicName: "T1",
				topicNumber: 1,
			},
		] as const;
		const g = groupTopicRowsByChapter([...rows]);
		expect(g).toHaveLength(1);
		expect(g[0].topics.map((t) => t.id)).toEqual(["b", "a"]);
	});
});

describe("parseStoredChapterMeta", () => {
	it("accepts chapter metadata even when unit_name is missing", () => {
		const parsed = parseStoredChapterMeta({
			doubt_scope: "chapter",
			chapter: {
				unit_number: 2,
				chapter_number: 4,
				chapter_name: "From the Diary of Anne Frank",
			},
		});

		expect(parsed).not.toBeNull();
		expect(parsed?.chapter.unit_number).toBe(2);
		expect(parsed?.chapter.chapter_number).toBe(4);
		expect(parsed?.chapter.chapter_name).toBe("From the Diary of Anne Frank");
		expect(parsed?.chapter.unit_name).toBe("Unit 2");
	});

	it("accepts legacy metadata with chapter coordinates but no scope tag", () => {
		const parsed = parseStoredChapterMeta({
			chapter: {
				unitNumber: 1,
				chapterNumber: 3,
				chapterName: "Glimpses of India",
				unitName: "First Flight",
			},
		});

		expect(parsed).not.toBeNull();
		expect(parsed?.doubt_scope).toBe("chapter");
		expect(parsed?.chapter.unit_number).toBe(1);
		expect(parsed?.chapter.chapter_number).toBe(3);
		expect(parsed?.chapter.chapter_name).toBe("Glimpses of India");
		expect(parsed?.chapter.unit_name).toBe("First Flight");
	});
});
