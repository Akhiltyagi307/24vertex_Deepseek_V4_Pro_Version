import { describe, expect, it } from "vitest";

import { rankAdvisoryActions } from "@/lib/student/review-advisory";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe("rankAdvisoryActions", () => {
	it("orders overdue review > due-soon review > weak unscheduled, capped at 5", () => {
		const actions = rankAdvisoryActions(
			[
				{ topicId: "a", topicName: "A", averageScore: 40, nextReviewAtMs: NOW - DAY }, // overdue
				{ topicId: "b", topicName: "B", averageScore: 55, nextReviewAtMs: NOW + DAY }, // due soon
				{ topicId: "c", topicName: "C", averageScore: 30, nextReviewAtMs: null }, // weak unscheduled
				{ topicId: "d", topicName: "D", averageScore: 95, nextReviewAtMs: null }, // strong → excluded
			],
			NOW,
		);
		expect(actions.map((a) => a.topicId)).toEqual(["a", "b", "c"]);
		expect(actions[0].reason).toBe("overdue");
		expect(actions.length).toBeLessThanOrEqual(5);
	});

	it("excludes mastered, unscheduled topics", () => {
		expect(
			rankAdvisoryActions(
				[{ topicId: "x", topicName: "X", averageScore: 90, nextReviewAtMs: null }],
				NOW,
			),
		).toEqual([]);
	});

	it("sorts multiple overdue topics most-overdue first", () => {
		const actions = rankAdvisoryActions(
			[
				{ topicId: "soon", topicName: "Soon", averageScore: 40, nextReviewAtMs: NOW - DAY },
				{ topicId: "old", topicName: "Old", averageScore: 40, nextReviewAtMs: NOW - 10 * DAY },
			],
			NOW,
		);
		expect(actions.map((a) => a.topicId)).toEqual(["old", "soon"]);
	});
});
