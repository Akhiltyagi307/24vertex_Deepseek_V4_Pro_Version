import { describe, expect, it } from "vitest";

import {
	computeReviewSchedule,
	REVIEW_SCHEDULE_CONFIG,
	type ReviewScheduleState,
} from "@/lib/practice/review-schedule";

const UNSCHEDULED: ReviewScheduleState = { intervalDays: null, ease: null, consecutiveGood: 0 };
const T0 = 1_700_000_000_000; // fixed epoch ms; no Date.now() in tests
const DAY = 86_400_000;

describe("computeReviewSchedule", () => {
	it("leaves a passing, unscheduled topic unscheduled (nothing to remediate)", () => {
		const r = computeReviewSchedule({ prior: UNSCHEDULED, topicScore: 90, nowMs: T0 });
		expect(r).toEqual({ intervalDays: null, ease: null, consecutiveGood: 0, nextReviewAt: null });
	});

	it("ENTERS scheduling on the first failing score (start interval + ease)", () => {
		const r = computeReviewSchedule({ prior: UNSCHEDULED, topicScore: 40, nowMs: T0 });
		expect(r.intervalDays).toBe(REVIEW_SCHEDULE_CONFIG.startIntervalDays);
		expect(r.ease).toBe(REVIEW_SCHEDULE_CONFIG.startEase);
		expect(r.consecutiveGood).toBe(0);
		expect(r.nextReviewAt).toBe(
			new Date(T0 + REVIEW_SCHEDULE_CONFIG.startIntervalDays * DAY).toISOString(),
		);
	});

	it("RESETS a scheduled topic to 1 day and lowers ease on a fail", () => {
		const prior: ReviewScheduleState = { intervalDays: 8, ease: 2.2, consecutiveGood: 2 };
		const r = computeReviewSchedule({ prior, topicScore: 30, nowMs: T0 });
		expect(r.intervalDays).toBe(1);
		expect(r.ease).toBeCloseTo(2.0, 5); // 2.2 - 0.2 step down
		expect(r.consecutiveGood).toBe(0);
		expect(r.nextReviewAt).toBe(new Date(T0 + DAY).toISOString());
	});

	it("STRETCHES the interval and raises ease on a pass", () => {
		const prior: ReviewScheduleState = { intervalDays: 2, ease: 2.0, consecutiveGood: 0 };
		const r = computeReviewSchedule({ prior, topicScore: 80, nowMs: T0 });
		expect(r.intervalDays).toBe(4); // round(2 * 2.0)
		expect(r.ease).toBeCloseTo(2.1, 5);
		expect(r.consecutiveGood).toBe(1);
		expect(r.nextReviewAt).toBe(new Date(T0 + 4 * DAY).toISOString());
	});

	it("GRADUATES (clears schedule) after the configured consecutive good streak", () => {
		const prior: ReviewScheduleState = { intervalDays: 8, ease: 2.2, consecutiveGood: 2 };
		const r = computeReviewSchedule({ prior, topicScore: 90, nowMs: T0 });
		expect(r.consecutiveGood).toBe(3);
		expect(r.intervalDays).toBeNull();
		expect(r.ease).toBeNull();
		expect(r.nextReviewAt).toBeNull();
	});

	it("clamps ease to the configured floor and never below", () => {
		const prior: ReviewScheduleState = {
			intervalDays: 1,
			ease: REVIEW_SCHEDULE_CONFIG.easeMin,
			consecutiveGood: 0,
		};
		const r = computeReviewSchedule({ prior, topicScore: 10, nowMs: T0 });
		expect(r.ease).toBe(REVIEW_SCHEDULE_CONFIG.easeMin);
	});

	it("treats exactly the pass threshold as a pass", () => {
		const r = computeReviewSchedule({
			prior: UNSCHEDULED,
			topicScore: REVIEW_SCHEDULE_CONFIG.masteryPassPct,
			nowMs: T0,
		});
		// passing + unscheduled → stays unscheduled
		expect(r.nextReviewAt).toBeNull();
	});
});
