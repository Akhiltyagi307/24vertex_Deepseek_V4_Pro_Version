import type { SupabaseClient } from "@supabase/supabase-js";

export const STREAK_REWARD_TARGET_WEEKS = 52;

export type StudentActivityStreakSnapshot = {
	streakWeeks: number;
	currentWeekActive: boolean;
	lastActiveWeekStart: string | null;
	longestStreakWeeks: number;
	weeksToReward: number;
	rewardGranted: boolean;
	rewardGrantedAt: string | null;
	/** Freezes banked (0 or 1); a freeze bridges a single missed week. */
	freezesAvailable: number;
	freezeLastUsedWeek: string | null;
};

type SnapshotRow = {
	streak_weeks: number | null;
	current_week_active: boolean | null;
	last_active_week_start: string | null;
	longest_streak_weeks: number | null;
	weeks_to_reward: number | null;
	reward_granted: boolean | null;
	reward_granted_at: string | null;
	freezes_available?: number | null;
	freeze_last_used_week?: string | null;
};

export function mapActivityStreakRow(row: SnapshotRow | null | undefined): StudentActivityStreakSnapshot {
	const streakWeeks = Math.max(0, Number(row?.streak_weeks ?? 0));
	return {
		streakWeeks,
		currentWeekActive: Boolean(row?.current_week_active),
		lastActiveWeekStart: row?.last_active_week_start ?? null,
		longestStreakWeeks: Math.max(0, Number(row?.longest_streak_weeks ?? 0)),
		weeksToReward: Math.max(0, Number(row?.weeks_to_reward ?? STREAK_REWARD_TARGET_WEEKS - streakWeeks)),
		rewardGranted: Boolean(row?.reward_granted),
		rewardGrantedAt: row?.reward_granted_at ?? null,
		freezesAvailable: Math.max(0, Number(row?.freezes_available ?? 1)),
		freezeLastUsedWeek: row?.freeze_last_used_week ?? null,
	};
}

export async function getStudentActivityStreakSnapshot(
	supabase: SupabaseClient,
	studentId: string,
): Promise<StudentActivityStreakSnapshot> {
	const { data, error } = await supabase.rpc("student_activity_streak_snapshot", {
		p_student_id: studentId,
	});

	if (error) {
		throw error;
	}

	const row = (Array.isArray(data) ? data[0] : data) as SnapshotRow | null;
	return mapActivityStreakRow(row);
}

/** Best-effort cache refresh after a test is submitted. */
export async function refreshStudentActivityStreak(
	supabase: SupabaseClient,
	studentId: string,
): Promise<void> {
	const { error } = await supabase.rpc("refresh_student_activity_streak", {
		p_student_id: studentId,
	});
	if (error) {
		throw error;
	}
}
