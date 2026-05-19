import { AssignmentsKanban } from "@/components/assignments/assignments-kanban";
import { listStudentAssignments } from "@/lib/assignments/queries";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";

export const dynamic = "force-dynamic";

export const metadata = { title: "Assignments" };

export default async function StudentAssignmentsPage() {
	const { user } = await requireVerifiedStudent();

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
