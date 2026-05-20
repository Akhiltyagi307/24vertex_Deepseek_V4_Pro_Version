import { describe, expect, it } from "vitest";

import { STREAK_REWARD_TARGET_WEEKS, mapActivityStreakRow } from "@/lib/student/activity-streak";

describe("mapActivityStreakRow", () => {
	it("maps RPC row with defaults for missing fields", () => {
		expect(
			mapActivityStreakRow({
				streak_weeks: 3,
				current_week_active: true,
				last_active_week_start: "2026-05-12",
				longest_streak_weeks: 5,
				weeks_to_reward: 49,
				reward_granted: false,
				reward_granted_at: null,
			}),
		).toEqual({
			streakWeeks: 3,
			currentWeekActive: true,
			lastActiveWeekStart: "2026-05-12",
			longestStreakWeeks: 5,
			weeksToReward: 49,
			rewardGranted: false,
			rewardGrantedAt: null,
		});
	});

	it("clamps negative streak values to zero", () => {
		const mapped = mapActivityStreakRow({
			streak_weeks: -2,
			current_week_active: false,
			last_active_week_start: null,
			longest_streak_weeks: null,
			weeks_to_reward: null,
			reward_granted: null,
			reward_granted_at: null,
		});
		expect(mapped.streakWeeks).toBe(0);
		expect(mapped.weeksToReward).toBe(STREAK_REWARD_TARGET_WEEKS);
	});
});
