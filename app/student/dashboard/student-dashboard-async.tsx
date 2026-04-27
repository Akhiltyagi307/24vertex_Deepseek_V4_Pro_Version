import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import type { StudentDashboardProfileRow } from "@/lib/student/load-student-dashboard";
import { loadStudentDashboardViewPayload } from "@/lib/student/load-student-dashboard";
import { createClient } from "@/lib/supabase/server";

export async function StudentDashboardAsync({
	userId,
	profileRow,
}: {
	userId: string;
	profileRow: StudentDashboardProfileRow;
}) {
	const supabase = await createClient();
	const payload = await loadStudentDashboardViewPayload(supabase, userId, profileRow);
	return <StudentDashboardView {...payload} />;
}
