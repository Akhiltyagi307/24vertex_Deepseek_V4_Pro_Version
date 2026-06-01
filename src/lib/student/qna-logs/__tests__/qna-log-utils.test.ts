import { describe, expect, it } from "vitest";

import { parseQnaLogQueryParams } from "@/lib/student/qna-logs/qna-log-query-params";
import { qnaLogPerformanceFromScore, qnaLogScorePercent } from "@/lib/student/qna-logs/qna-log-performance";
import {
	buildVerdictNarrative,
	verdictHeadline,
	verdictTone,
} from "@/lib/student/qna-logs/qna-log-verdict";
import { truncateQuestionPreview } from "@/lib/student/qna-logs/truncate-question-preview";
import type { QnaLogDetail } from "@/lib/student/qna-logs/types";

function makeDetail(overrides: Partial<QnaLogDetail>): QnaLogDetail {
	return {
		answerId: "answer-id",
		questionId: "question-id",
		testId: "test-id",
		topicId: "topic-id",
		questionNumber: 1,
		questionText: "What is matter?",
		questionType: "multiple_choice",
		difficultyLevel: null,
		dateIso: null,
		source: "practice",
		testStatus: "graded",
		performance: "incorrect",
		scorePercent: 0,
		subjectId: "subject-id",
		subjectName: "Chemistry",
		topicName: "Nature of Matter",
		chapterName: "Some Basic Concepts",
		options: { A: "Weight only", B: "Mass and space", C: "Living things", D: "Touchable" },
		studentAnswerDisplay: "Selected: A",
		studentSelectedKey: "A",
		correctOptionKey: "B",
		correctAnswerDisplay: "Correct answer: B",
		correctAnswerSummary: null,
		aiFeedback: null,
		aiUserAnswerSummary: null,
		aiReferenceAnswerSummary: null,
		visual: null,
		...overrides,
	};
}

describe("truncateQuestionPreview", () => {
	it("collapses whitespace and truncates to 20 chars", () => {
		expect(truncateQuestionPreview("  Work   done in 5 seconds  ", 20)).toBe("Work done in 5 secon…");
	});

	it("keeps short strings untouched", () => {
		expect(truncateQuestionPreview("Potential energy", 20)).toBe("Potential energy");
	});
});

describe("qnaLogPerformanceFromScore", () => {
	it("returns pending for submitted tests", () => {
		expect(qnaLogPerformanceFromScore("submitted", "99")).toBe("pending");
	});

	it("maps graded thresholds correctly", () => {
		expect(qnaLogPerformanceFromScore("graded", "85")).toBe("correct");
		expect(qnaLogPerformanceFromScore("graded", "84.9")).toBe("partial");
		expect(qnaLogPerformanceFromScore("graded", "24.9")).toBe("incorrect");
	});

	it("returns pending when graded score is missing", () => {
		expect(qnaLogPerformanceFromScore("graded", null)).toBe("pending");
	});
});

describe("qnaLogScorePercent", () => {
	it("rounds numeric scores", () => {
		expect(qnaLogScorePercent("73.6")).toBe(74);
	});

	it("returns null for invalid scores", () => {
		expect(qnaLogScorePercent("abc")).toBeNull();
	});
});

describe("parseQnaLogQueryParams", () => {
	it("applies defaults when query is empty", () => {
		const parsed = parseQnaLogQueryParams(new URLSearchParams());
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.page).toBe(1);
		expect(parsed.value.pageSize).toBe(50);
		expect(parsed.value.sort).toEqual({ key: "date", dir: "desc" });
	});

	it("parses valid filters and sort options", () => {
		const parsed = parseQnaLogQueryParams(
			new URLSearchParams({
				page: "2",
				page_size: "100",
				q: "algebra",
				subject: "123e4567-e89b-12d3-a456-426614174000",
				source: "practice",
				performance: "partial",
				type: "short_answer",
				sort: "subject",
				dir: "asc",
				from: "2026-04-01",
				to: "2026-04-30",
				a: "123e4567-e89b-12d3-a456-426614174001",
			}),
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.page).toBe(2);
		expect(parsed.value.pageSize).toBe(100);
		expect(parsed.value.filters.source).toBe("practice");
		expect(parsed.value.sort).toEqual({ key: "subject", dir: "asc" });
		expect(parsed.value.activeAnswerId).toBe("123e4567-e89b-12d3-a456-426614174001");
	});

	it("rejects unknown keys because schema is strict", () => {
		const parsed = parseQnaLogQueryParams(new URLSearchParams({ unknown: "1" }));
		expect(parsed.ok).toBe(false);
	});

	it("rejects reversed date ranges", () => {
		const parsed = parseQnaLogQueryParams(
			new URLSearchParams({
				from: "2026-05-20",
				to: "2026-05-01",
			}),
		);
		expect(parsed.ok).toBe(false);
	});
});

describe("verdictHeadline", () => {
	it("returns coach headlines for self voice", () => {
		expect(verdictHeadline("correct", "self")).toBe("You got this");
		expect(verdictHeadline("partial", "self")).toBe("Almost there");
		expect(verdictHeadline("incorrect", "self")).toBe("Not quite");
		expect(verdictHeadline("pending", "self")).toBe("Awaiting grade");
	});

	it("switches to child phrasing for correct in child voice", () => {
		expect(verdictHeadline("correct", "child")).toBe("They got this");
		expect(verdictHeadline("incorrect", "child")).toBe("Not quite");
	});
});

describe("verdictTone", () => {
	it("returns distinct token sets per performance bucket", () => {
		const correctTone = verdictTone("correct");
		const incorrectTone = verdictTone("incorrect");
		const pendingTone = verdictTone("pending");
		expect(correctTone.surface).toMatch(/emerald/);
		expect(incorrectTone.surface).toMatch(/rose/);
		expect(pendingTone.surface).not.toMatch(/emerald|rose|amber/);
	});
});

describe("buildVerdictNarrative", () => {
	it("speaks the correct sentence when MCQ was right", () => {
		const narrative = buildVerdictNarrative(
			makeDetail({
				performance: "correct",
				studentSelectedKey: "B",
				correctOptionKey: "B",
			}),
			"self",
		);
		expect(narrative.kind).toBe("graded-mcq");
		if (narrative.kind !== "graded-mcq") return;
		expect(narrative.sentence).toMatch(/You picked B: Mass and space\. That is the answer\./);
	});

	it("contrasts chosen vs correct when MCQ was wrong (self voice)", () => {
		const narrative = buildVerdictNarrative(makeDetail({}), "self");
		expect(narrative.kind).toBe("graded-mcq");
		if (narrative.kind !== "graded-mcq") return;
		expect(narrative.sentence).toMatch(/You picked A: Weight only\./);
		expect(narrative.sentence).toMatch(/The answer was B: Mass and space\./);
	});

	it("uses 'Your child picked' for the child voice", () => {
		const narrative = buildVerdictNarrative(makeDetail({}), "child");
		expect(narrative.kind).toBe("graded-mcq");
		if (narrative.kind !== "graded-mcq") return;
		expect(narrative.sentence).toMatch(/Your child picked A/);
	});

	it("handles MCQ with no option selected", () => {
		const narrative = buildVerdictNarrative(
			makeDetail({ studentSelectedKey: null, studentAnswerDisplay: "(no option selected)" }),
			"self",
		);
		expect(narrative.kind).toBe("graded-mcq");
		if (narrative.kind !== "graded-mcq") return;
		expect(narrative.sentence).toMatch(/No option selected\./);
		expect(narrative.sentence).toMatch(/B: Mass and space/);
	});

	it("returns a side-by-side narrative for non-MCQ graded answers", () => {
		const narrative = buildVerdictNarrative(
			makeDetail({
				questionType: "short_answer",
				options: null,
				studentSelectedKey: null,
				correctOptionKey: null,
				studentAnswerDisplay: "It absorbs heat.",
				correctAnswerDisplay: "It expands when heated.",
				performance: "partial",
			}),
			"self",
		);
		expect(narrative.kind).toBe("graded-text");
		if (narrative.kind !== "graded-text") return;
		expect(narrative.chosenLabel).toBe("What you tried");
		expect(narrative.correctLabel).toBe("What was right");
		expect(narrative.chosenAnswer).toBe("It absorbs heat.");
		expect(narrative.correctAnswer).toBe("It expands when heated.");
	});

	it("falls back to a pending narrative before grading", () => {
		const narrative = buildVerdictNarrative(
			makeDetail({
				testStatus: "submitted",
				performance: "pending",
				correctOptionKey: null,
				correctAnswerDisplay: null,
			}),
			"self",
		);
		expect(narrative.kind).toBe("pending");
		if (narrative.kind !== "pending") return;
		expect(narrative.note).toMatch(/after grading/i);
		expect(narrative.chosenLabel).toBe("What you tried");
	});
});
