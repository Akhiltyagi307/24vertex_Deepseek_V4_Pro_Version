import { revalidateTag } from "next/cache";

import { studentDashboardCacheTag } from "@/lib/student/student-dashboard-cache";

/** Bust student (and parent child) dashboard cache after tests, tracker, or assignments change. */
export function revalidateStudentDashboard(studentId: string): void {
	revalidateTag(studentDashboardCacheTag(studentId), "max");
}
