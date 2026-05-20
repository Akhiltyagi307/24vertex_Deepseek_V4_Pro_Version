import type { SupabaseClient } from "@supabase/supabase-js";

import { refreshStudentActivityStreak } from "@/lib/student/activity-streak";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

/** Updates streak cache after submit; never blocks the submit flow. */
export function refreshActivityStreakAfterSubmit(
	supabase: SupabaseClient,
	studentId: string,
): void {
	void refreshStudentActivityStreak(supabase, studentId).catch((err) => {
			logSupabaseError("student.activity_streak.refresh_after_submit", err as { message?: string }, {
				studentId,
			});
		});
}
