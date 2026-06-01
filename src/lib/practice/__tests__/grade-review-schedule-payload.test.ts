import { describe, expect, it } from "vitest";

import { buildTrackerPayloadItems } from "@/lib/practice/review-schedule-payload";

const T0 = 1_700_000_000_000;

describe("buildTrackerPayloadItems", () => {
	it("attaches advanced schedule keys per topic rollup", () => {
		const items = buildTrackerPayloadItems({
			rollups: [
				{ topic_id: "11111111-1111-1111-1111-111111111111", average_score: 40, n_incorrect: 3 },
			],
			priorByTopic: new Map(),
			nowMs: T0,
		});
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			topic_id: "11111111-1111-1111-1111-111111111111",
			average_score: 40,
			n_incorrect: 3,
			review_interval_days: 2, // ENTER on a fail
			consecutive_good: 0,
		});
		expect(items[0].next_review_at).toBe(new Date(T0 + 2 * 86_400_000).toISOString());
	});

	it("clears the schedule on graduation (3rd consecutive pass)", () => {
		const items = buildTrackerPayloadItems({
			rollups: [
				{ topic_id: "22222222-2222-2222-2222-222222222222", average_score: 90, n_incorrect: 0 },
			],
			priorByTopic: new Map([
				["22222222-2222-2222-2222-222222222222", { intervalDays: 8, ease: 2.2, consecutiveGood: 2 }],
			]),
			nowMs: T0,
		});
		expect(items[0].next_review_at).toBeNull();
		expect(items[0].review_interval_days).toBeNull();
		expect(items[0].consecutive_good).toBe(3);
	});
});
