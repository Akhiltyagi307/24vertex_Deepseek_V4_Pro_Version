import { describe, expect, it } from "vitest";

import {
	getDoubtSharedPreamble,
	getDoubtSubjectPackForSubjectName,
} from "@/lib/ai/doubt-prompt-templates";
import { buildDoubtSystemPrompt } from "@/lib/ai/doubt-system-prompt";
import { groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import { resolveSubjectKey } from "@/lib/doubt/subject-packs";
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

	it("quiz_me mode includes scope and QUIZ ME MODE", () => {
		const s = buildDoubtSystemPrompt(sampleScope, "quiz_me");
		expect(s).toContain("Mathematics");
		expect(s).toContain("Irrational Numbers");
		expect(s).toContain("Grade 9");
		expect(s).toContain("QUIZ ME MODE");
		// One-question-at-a-time + grading rules are the load-bearing differentiators.
		expect(s).toContain("one at a time");
		expect(s).toContain("Score so far");
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

	it("shares an identical preamble prefix across modes (cache-prefix invariant)", () => {
		// DeepSeek's prompt cache is byte-exact prefix match. The shared preamble
		// must appear identically at the start of every mode's rendered prompt
		// so two students hitting different topics share a cache prefix. A
		// failure here means a recent prompt edit drifted the modes apart.
		const explain = buildDoubtSystemPrompt(sampleScope, "explain");
		const solve = buildDoubtSystemPrompt(sampleScope, "solve_with_me");
		const quiz = buildDoubtSystemPrompt(sampleScope, "quiz_me");
		const preamble = getDoubtSharedPreamble();
		expect(preamble.length).toBeGreaterThan(800);
		expect(explain.startsWith(preamble)).toBe(true);
		expect(solve.startsWith(preamble)).toBe(true);
		expect(quiz.startsWith(preamble)).toBe(true);
	});

	it("contains scope + tail after the preamble (structural ordering)", () => {
		const s = buildDoubtSystemPrompt(sampleScope, "explain");
		const preambleEnd = getDoubtSharedPreamble().length;
		const scopeIdx = s.indexOf("## Scope (stay strictly on topic)");
		const tailIdx = s.indexOf("## Mode: EXPLAIN");
		expect(scopeIdx).toBeGreaterThanOrEqual(preambleEnd);
		expect(tailIdx).toBeGreaterThan(scopeIdx);
	});

	it("inserts the Mathematics subject pack for a Mathematics scope", () => {
		const s = buildDoubtSystemPrompt(sampleScope, "explain");
		// sampleScope.subjectName is "Mathematics" — should resolve and inject.
		expect(s).toContain("## Subject-specific guidance — Mathematics");
		// Math-pack distinctive content:
		expect(s).toContain("Hence proved");
		// Pack sits between preamble and scope (structural ordering).
		const preambleEnd = getDoubtSharedPreamble().length;
		const packIdx = s.indexOf("## Subject-specific guidance — Mathematics");
		const scopeIdx = s.indexOf("## Scope (stay strictly on topic)");
		expect(packIdx).toBeGreaterThanOrEqual(preambleEnd);
		expect(packIdx).toBeLessThan(scopeIdx);
	});

	it("inserts the Physics subject pack when subjectName is Physics", () => {
		const physicsScope: DoubtScopeSuccess = { ...sampleScope, subjectName: "Physics" };
		const s = buildDoubtSystemPrompt(physicsScope, "solve_with_me");
		expect(s).toContain("## Subject-specific guidance — Physics");
		// Physics-pack distinctive content:
		expect(s).toContain("Sign convention errors");
	});

	it("omits the subject pack gracefully when subject does not match a known pack", () => {
		const obscureScope: DoubtScopeSuccess = { ...sampleScope, subjectName: "Sanskrit" };
		const s = buildDoubtSystemPrompt(obscureScope, "explain");
		// No subject pack inserted, but the prompt still renders cleanly.
		expect(s).not.toContain("## Subject-specific guidance");
		// Preamble, scope, and tail all still present.
		expect(s.startsWith(getDoubtSharedPreamble())).toBe(true);
		expect(s).toContain("## Scope (stay strictly on topic)");
		expect(s).toContain("## Mode: EXPLAIN");
	});

	it("two prompts on the same subject share preamble+pack as cache prefix", () => {
		// Different topic, same subject → identical bytes from preamble through end-of-pack.
		const physicsTopicA: DoubtScopeSuccess = { ...sampleScope, subjectName: "Physics" };
		const physicsTopicB: DoubtScopeSuccess = {
			...sampleScope,
			subjectName: "Physics",
			topic: { ...sampleScope.topic, topicName: "Refraction", topicNumber: 3 },
		};
		const a = buildDoubtSystemPrompt(physicsTopicA, "explain");
		const b = buildDoubtSystemPrompt(physicsTopicB, "explain");
		const physicsPack = getDoubtSubjectPackForSubjectName("Physics");
		expect(physicsPack).not.toBeNull();
		const sharedPrefix = `${getDoubtSharedPreamble()}\n\n${physicsPack}`;
		expect(a.startsWith(sharedPrefix)).toBe(true);
		expect(b.startsWith(sharedPrefix)).toBe(true);
	});
});

describe("resolveSubjectKey", () => {
	it("maps Mathematics / Maths / Math to mathematics", () => {
		expect(resolveSubjectKey("Mathematics")).toBe("mathematics");
		expect(resolveSubjectKey("Maths")).toBe("mathematics");
		expect(resolveSubjectKey("Math")).toBe("mathematics");
	});

	it("maps Physics / Chemistry / Biology to their own packs (not generic science)", () => {
		expect(resolveSubjectKey("Physics")).toBe("physics");
		expect(resolveSubjectKey("Chemistry")).toBe("chemistry");
		expect(resolveSubjectKey("Biology")).toBe("biology");
	});

	it("maps generic Science (grades 6-10) to the combined science pack", () => {
		expect(resolveSubjectKey("Science")).toBe("science");
	});

	it("maps Political Science and Civics to the same pack", () => {
		expect(resolveSubjectKey("Political Science")).toBe("political-science");
		expect(resolveSubjectKey("Civics")).toBe("political-science");
	});

	it("maps Social Science and SST to the combined social-science pack", () => {
		expect(resolveSubjectKey("Social Science")).toBe("social-science");
		expect(resolveSubjectKey("SST")).toBe("social-science");
	});

	it("returns null for subjects without a pack today", () => {
		expect(resolveSubjectKey("Hindi")).toBeNull();
		expect(resolveSubjectKey("Sanskrit")).toBeNull();
		expect(resolveSubjectKey("Accountancy")).toBeNull();
		expect(resolveSubjectKey("")).toBeNull();
		expect(resolveSubjectKey(null)).toBeNull();
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
