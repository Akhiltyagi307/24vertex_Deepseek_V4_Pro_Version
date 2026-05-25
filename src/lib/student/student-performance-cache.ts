import "server-only";

import { unstable_cache } from "next/cache";

import { getCachedTopicCountsBySubjectForGrade } from "@/lib/cache/curriculum-topic-counts";
import {
	loadStudentPerformanceBundle,
	type StudentProfileSubjectsRow,
} from "@/lib/student/student-performance-load";
import { studentDashboardCacheTag } from "@/lib/student/student-dashboard-cache";
import { createBearerSupabaseClient, getServerAccessToken } from "@/lib/supabase/bearer-client";

type CachedPerformanceCore = {
	enrolledSubjects: Awaited<ReturnType<typeof loadStudentPerformanceBundle>>["enrolledSubjects"];
	rows: Awaited<ReturnType<typeof loadStudentPerformanceBundle>>["rows"];
	loadError: string | null;
};

/**
 * Cached performance tracker bundle (60s). Topic counts are loaded outside this cache
 * (`Map` does not survive `unstable_cache` JSON round-trip). Invalidate via
 * {@link studentDashboardCacheTag} when tests, tracker, or assignments change.
 */
export async function loadStudentPerformanceBundleCached(
	userId: string,
	profileRow: StudentProfileSubjectsRow,
) {
	const accessToken = await getServerAccessToken();
	const cached = unstable_cache(
		async (): Promise<CachedPerformanceCore> => {
			const bundle = await loadStudentPerformanceBundle(
				createBearerSupabaseClient(accessToken),
				userId,
				profileRow,
			);
			return {
				enrolledSubjects: bundle.enrolledSubjects,
				rows: bundle.rows,
				loadError: bundle.loadError,
			};
		},
		["student-performance-bundle", userId, String(profileRow.grade ?? ""), profileRow.stream ?? ""],
		{
			revalidate: 60,
			tags: [studentDashboardCacheTag(userId)],
		},
	);

	const { enrolledSubjects, rows, loadError } = await cached();
	const enrolledIds = enrolledSubjects.map((s) => s.id);
	const topicCountBySubjectId =
		profileRow.grade != null && enrolledIds.length > 0
			? await getCachedTopicCountsBySubjectForGrade(profileRow.grade, enrolledIds)
			: new Map<string, number>();

	let totalCurriculumTopics = 0;
	for (const sid of enrolledIds) {
		totalCurriculumTopics += topicCountBySubjectId.get(sid) ?? 0;
	}

	const trackerNeedsHydration =
		totalCurriculumTopics > 0 && rows.length === 0 && loadError == null;

	return {
		enrolledSubjects,
		topicCountBySubjectId,
		rows,
		loadError,
		trackerNeedsHydration,
	};
}
