import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssignmentsKanban } from "@/components/assignments/assignments-kanban";
import { listStudentAssignments } from "@/lib/assignments/queries";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getParentActiveStudentIdFromCookie } from "@/lib/parent/active-student-cookie";
import { assertParentActiveLink } from "@/lib/parent/linked-children";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Assignments · Parent",
	description: "Track teacher-assigned practice tests for your child from “to do” through graded.",
	robots: { index: false, follow: false },
};

export default async function ParentAssignmentsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	const activeStudentId = await getParentActiveStudentIdFromCookie();
	if (!activeStudentId) redirect("/parent/select-student");

	const linked = await assertParentActiveLink(user.id, activeStudentId);
	if (!linked) redirect("/parent/select-student");

	const assignments = await listStudentAssignments(activeStudentId);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6 py-6">
			<div className="space-y-1.5">
				<h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Follow teacher practice tests in three columns: to do, in progress, and graded (including
					submitted work waiting on scores).
				</p>
			</div>
			<AssignmentsKanban assignments={assignments} portal="parent" />
		</div>
	);
}
