import { describe, expect, it } from "vitest";

import { buildDoubtSystemPrompt } from "@/lib/ai/doubt-system-prompt";
import { groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

const sampleScope: DoubtScopeSuccess = {
	ok: true,
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
