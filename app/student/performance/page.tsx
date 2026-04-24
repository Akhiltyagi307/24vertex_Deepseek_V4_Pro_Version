import { redirect } from "next/navigation";

import { StudentPerformanceView } from "@/components/student/student-performance-view";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { buildEnrolledSubjectCards } from "@/lib/student/performance-matrix";
import { loadStudentPerformanceBundle } from "@/lib/student/student-performance-load";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function StudentPerformancePage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

	const supabase = await createClient();
	const { enrolledSubjects, topicCountBySubjectId, rows, loadError } = await loadStudentPerformanceBundle(
		supabase,
		user.id,
		{
			grade: row.grade,
			stream: row.stream,
			elective_subject_id: row.elective_subject_id,
			role: row.role,
		},
	);

	const enrolledSubjectCards = buildEnrolledSubjectCards(enrolledSubjects, topicCountBySubjectId, rows);

	return (
		<StudentPerformanceView
			initialRows={rows}
			loadError={loadError}
			subjectFromUrl={sp.subject ?? null}
			enrolledSubjectCards={enrolledSubjectCards}
			profileGrade={row.grade}
		/>
	);
}
