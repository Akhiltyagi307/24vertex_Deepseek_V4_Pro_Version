import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import type {
	LoadStudentDashboardOptions,
	StudentDashboardProfileRow,
} from "@/lib/student/load-student-dashboard";
import { loadStudentDashboardViewPayload } from "@/lib/student/load-student-dashboard";
import { createClient } from "@/lib/supabase/server";

export async function StudentDashboardAsync({
	userId,
	profileRow,
	loadOpts,
	viewVariant = "student",
}: {
	userId: string;
	profileRow: StudentDashboardProfileRow;
	loadOpts?: LoadStudentDashboardOptions;
	viewVariant?: "student" | "parent";
}) {
	const supabase = await createClient();
	const payload = await loadStudentDashboardViewPayload(supabase, userId, profileRow, {
		...loadOpts,
		viewerRole: viewVariant,
	});
	return <StudentDashboardView {...payload} variant={viewVariant} />;
}
