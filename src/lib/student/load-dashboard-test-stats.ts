import "server-only";

import {
	dashboardStatsWindowKeys,
	dateKeyToIsoStartInAppTz,
	type DashboardCompletedTestInput,
} from "@/lib/student/dashboard-performance-stats";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const COMPLETED_STATUSES = ["submitted", "graded"] as const;

/**
 * Bounded reads for dashboard KPIs: lifetime count, last-30d metrics rows, streak dates.
 */
export async function loadDashboardCompletedTestInput(
	supabase: SupabaseServer,
	userId: string,
): Promise<DashboardCompletedTestInput> {
	const { startKey30, streakStartKey } = dashboardStatsWindowKeys();
	const recentFromIso = dateKeyToIsoStartInAppTz(startKey30);
	const streakFromIso = dateKeyToIsoStartInAppTz(streakStartKey);

	const [countRes, recentRes, streakRes] = await Promise.all([
		supabase
			.from("tests")
			.select("id", { count: "exact", head: true })
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", [...COMPLETED_STATUSES]),
		supabase
			.from("tests")
			.select("test_date, total_score, duration_seconds")
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", [...COMPLETED_STATUSES])
			.not("test_date", "is", null)
			.gte("test_date", recentFromIso),
		supabase
			.from("tests")
			.select("test_date")
			.eq("student_id", userId)
			.eq("is_draft", false)
			.in("status", [...COMPLETED_STATUSES])
			.not("test_date", "is", null)
			.gte("test_date", streakFromIso),
	]);

	if (countRes.error) {
		logSupabaseError("loadDashboardCompletedTestInput.tests.count", countRes.error, { userId });
	}
	if (recentRes.error) {
		logSupabaseError("loadDashboardCompletedTestInput.tests.recent", recentRes.error, { userId });
	}
	if (streakRes.error) {
		logSupabaseError("loadDashboardCompletedTestInput.tests.streak", streakRes.error, { userId });
	}

	return {
		testsCompleted: countRes.count ?? 0,
		recentTests: recentRes.data ?? [],
		streakTestDates: streakRes.data ?? [],
	};
}
