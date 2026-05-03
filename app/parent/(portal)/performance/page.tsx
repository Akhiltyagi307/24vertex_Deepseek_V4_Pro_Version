import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentPerformanceAsync } from "../../../student/performance/student-performance-async";
import { StudentPerformanceSkeleton } from "../../../student/performance/student-performance-skeleton";
import { getServerUser } from "@/lib/auth/get-server-user";
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

	const profileRow = {
		grade: row.grade,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
	};

	return (
		<Suspense fallback={<StudentPerformanceSkeleton />}>
			<StudentPerformanceAsync
				userId={activeId}
				profileRow={profileRow}
				subjectFromUrl={sp.subject ?? null}
				portalBasePath="/parent"
				parentViewer
			/>
		</Suspense>
	);
}
