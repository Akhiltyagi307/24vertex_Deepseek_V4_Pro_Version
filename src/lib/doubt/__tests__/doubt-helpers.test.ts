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
	it("includes subject, topic, and grade in the system prompt", () => {
		const s = buildDoubtSystemPrompt(sampleScope);
		expect(s).toContain("Mathematics");
		expect(s).toContain("Irrational Numbers");
		expect(s).toContain("Grade 9");
		expect(s).toContain("Short description for tests.");
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
