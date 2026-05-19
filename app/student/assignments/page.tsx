import { AssignmentsKanban } from "@/components/assignments/assignments-kanban";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { listStudentAssignments } from "@/lib/assignments/queries";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import { studentMainPageShellClassName } from "@/lib/student/student-hub-page-layout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Assignments" };

export default async function StudentAssignmentsPage() {
	const { user } = await requireVerifiedStudent();

	const assignments = await listStudentAssignments(user.id);

	return (
		<div className={studentMainPageShellClassName}>
			<header className="flex w-full min-w-0 max-w-none shrink-0 flex-col gap-1.5">
				<h1 className="text-balance font-semibold text-3xl tracking-tight text-foreground">
					Assignments
				</h1>
				<PageHeaderSubtext variant="wrap">
					Track teacher-assigned practice tests from generation through grading.
				</PageHeaderSubtext>
			</header>
			<AssignmentsKanban assignments={assignments} portal="student" />
		</div>
	);
}
