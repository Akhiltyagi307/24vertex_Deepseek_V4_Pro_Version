import { redirect } from "next/navigation";

import { AssignmentsKanban } from "@/components/assignments/assignments-kanban";
import { listStudentAssignments } from "@/lib/assignments/queries";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "student") redirect("/login");

	const assignments = await listStudentAssignments(user.id);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6 py-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
				<p className="text-sm text-muted-foreground">
					Track teacher-assigned practice tests from generation through grading.
				</p>
			</div>
			<AssignmentsKanban assignments={assignments} portal="student" />
		</div>
	);
}
