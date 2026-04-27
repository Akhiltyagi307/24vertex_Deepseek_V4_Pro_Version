import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StudentDashboardAsync } from "./student-dashboard-async";
import { StudentDashboardSkeleton } from "./student-dashboard-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
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
			<StudentDashboardAsync userId={user.id} profileRow={profileRow} />
		</Suspense>
	);
}
