import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentDashboardAsync } from "../../../student/dashboard/student-dashboard-async";
import { StudentDashboardSkeleton } from "../../../student/dashboard/student-dashboard-skeleton";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ParentDashboardPage() {
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
		.select("grade, section, stream, elective_subject_id, role, full_name")
		.eq("id", activeId)
		.maybeSingle();

	if (!row || row.role !== "student") {
		redirect("/parent/select-student");
	}

	const profileRow = {
		grade: row.grade,
		section: row.section,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
		full_name: row.full_name,
	};

	return (
		<Suspense fallback={<StudentDashboardSkeleton />}>
			<StudentDashboardAsync
				userId={activeId}
				profileRow={profileRow}
				loadOpts={{ subjectCardLinkMode: "performance", performancePathPrefix: "/parent/performance" }}
				viewVariant="parent"
			/>
		</Suspense>
	);
}
