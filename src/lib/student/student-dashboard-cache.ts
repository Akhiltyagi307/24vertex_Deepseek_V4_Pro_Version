import "server-only";

import { unstable_cache } from "next/cache";

import type { LoadStudentDashboardOptions, StudentDashboardCorePayload } from "@/lib/student/load-student-dashboard";
import { loadStudentDashboardCorePayload } from "@/lib/student/load-student-dashboard";
import type { StudentDashboardProfileRow } from "@/lib/student/load-student-dashboard";
import { createBearerSupabaseClient, getServerAccessToken } from "@/lib/supabase/bearer-client";

export function studentDashboardCacheTag(studentId: string): string {
	return `student-dashboard:${studentId}`;
}

/**
 * Cached core dashboard bundle (60s). Leaderboard loads separately under Suspense.
 * Invalidate via {@link revalidateStudentDashboard} when tests, tracker, or assignments change.
 */
export async function loadStudentDashboardCorePayloadCached(
	userId: string,
	profileRow: StudentDashboardProfileRow,
	opts?: LoadStudentDashboardOptions,
): Promise<StudentDashboardCorePayload> {
	// Cookie-bound SSR clients still touch `cookies()` on query; use a bearer client inside cache.
	const accessToken = await getServerAccessToken();
	const cached = unstable_cache(
		async () =>
			loadStudentDashboardCorePayload(createBearerSupabaseClient(accessToken), userId, profileRow, opts),
		[
			"student-dashboard-core",
			userId,
			profileRow.organization_id ?? "none",
			opts?.viewerRole ?? "student",
			opts?.subjectCardLinkMode ?? "practice",
		],
		{
			revalidate: 60,
			tags: [studentDashboardCacheTag(userId)],
		},
	);
	return cached();
}
