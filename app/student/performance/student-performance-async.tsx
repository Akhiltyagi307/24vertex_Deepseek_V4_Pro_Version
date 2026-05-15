import { StudentPerformanceView } from "@/components/student/student-performance-view";
import type { AppProfileRow } from "@/lib/auth/cached-profile";
import { buildEnrolledSubjectCards } from "@/lib/student/performance-matrix";
import { loadStudentPerformanceBundle } from "@/lib/student/student-performance-load";
import { createClient } from "@/lib/supabase/server";

type Props = {
	userId: string;
	profileRow: Pick<AppProfileRow, "grade" | "stream" | "elective_subject_id" | "role">;
	subjectFromUrl: string | null;
	portalBasePath?: string;
	parentViewer?: boolean;
	/** When `parentViewer`, defaults to `/parent/dashboard` — teachers override with `/teacher/student-performance`. */
	viewerOverviewHref?: string;
};

/** Streamed under <Suspense> so the shell renders before this query block resolves. */
export async function StudentPerformanceAsync({
	userId,
	profileRow,
	subjectFromUrl,
	portalBasePath,
	parentViewer,
	viewerOverviewHref,
}: Props) {
	const supabase = await createClient();

	const { enrolledSubjects, topicCountBySubjectId, rows, loadError, trackerNeedsHydration } =
		await loadStudentPerformanceBundle(supabase, userId, profileRow);

	const enrolledSubjectCards = buildEnrolledSubjectCards(enrolledSubjects, topicCountBySubjectId, rows);

	return (
		<StudentPerformanceView
			initialRows={rows}
			loadError={loadError}
			subjectFromUrl={subjectFromUrl}
			enrolledSubjectCards={enrolledSubjectCards}
			profileGrade={profileRow.grade ?? null}
			trackerNeedsHydration={parentViewer ? false : trackerNeedsHydration}
			portalBasePath={portalBasePath}
			parentViewer={parentViewer}
			viewerOverviewHref={viewerOverviewHref}
		/>
	);
}
