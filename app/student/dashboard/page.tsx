import { Suspense } from "react";

import { StudentDashboardAsync } from "./student-dashboard-async";
import { StudentDashboardSkeleton } from "./student-dashboard-skeleton";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function StudentDashboardPage() {
	const { user, profile: row } = await requireVerifiedStudent();

	const profileRow = {
		grade: row.grade,
		section: row.section,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
		full_name: row.full_name,
		organization_id: row.organization_id ?? null,
		created_at: row.created_at ?? null,
	};

	return (
		<Suspense fallback={<StudentDashboardSkeleton />}>
			<StudentDashboardAsync userId={user.id} profileRow={profileRow} />
		</Suspense>
	);
}
