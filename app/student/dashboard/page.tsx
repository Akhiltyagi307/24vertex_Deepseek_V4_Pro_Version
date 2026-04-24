import { redirect } from "next/navigation";

import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { loadStudentDashboardViewPayload } from "@/lib/student/load-student-dashboard";
import { createClient } from "@/lib/supabase/server";

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

	const supabase = await createClient();
	const payload = await loadStudentDashboardViewPayload(supabase, user.id, {
		grade: row.grade,
		section: row.section,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		role: row.role,
		full_name: row.full_name,
	});

	return <StudentDashboardView {...payload} />;
}
