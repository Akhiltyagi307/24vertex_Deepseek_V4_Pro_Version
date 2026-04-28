import { redirect } from "next/navigation";

import { StudentPerformanceView } from "@/components/student/student-performance-view";
import { getServerUser } from "@/lib/auth/get-server-user";
import { buildEnrolledSubjectCards } from "@/lib/student/performance-matrix";
import { loadStudentPerformanceBundle } from "@/lib/student/student-performance-load";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
	searchParams: Promise<{ subject?: string }>;
};

export default async function ParentPerformancePage({ searchParams }: PageProps) {
	const sp = await searchParams;
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const activeId = await getParentActiveStudentIdFromCookie();
	if (!activeId) {
		redirect("/parent/select-student");
	}
	const ok = await assertParentActiveLink(user.id, activeId);
	if (!ok) {
		redirect("/parent/select-student");
	}

	const supabase = await createClient();
	const { data: row } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", activeId)
		.maybeSingle();

	if (!row || row.role !== "student") {
		redirect("/parent/select-student");
	}

	const { enrolledSubjects, topicCountBySubjectId, rows, loadError, trackerNeedsHydration } =
		await loadStudentPerformanceBundle(
			supabase,
			activeId,
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
			trackerNeedsHydration={trackerNeedsHydration}
			portalBasePath="/parent"
			parentViewer
		/>
	);
}
