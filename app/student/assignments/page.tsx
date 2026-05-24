import Link from "next/link";

import { AssignmentsKanban } from "@/components/assignments/assignments-kanban";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { Button } from "@/components/ui/button";
import { listStudentAssignments } from "@/lib/assignments/queries";
import { requireVerifiedStudent } from "@/lib/auth/require-verified-student";
import {
	filterOpenAssignments,
	summarizeOpenAssignments,
} from "@/lib/student/dashboard-open-assignments";
import { studentMainPageShellClassName } from "@/lib/student/student-hub-page-layout";

export const dynamic = "force-dynamic";

export const metadata = { title: "Assignments" };

export default async function StudentAssignmentsPage() {
	const { user } = await requireVerifiedStudent();

	const assignments = await listStudentAssignments(user.id);
	const open = filterOpenAssignments(assignments);
	const summary = summarizeOpenAssignments(open);
	const hasUrgent = summary.overdue > 0 || summary.dueSoon > 0;

	return (
		<div className={studentMainPageShellClassName}>
			<header className="flex w-full min-w-0 max-w-none shrink-0 flex-col gap-3">
				<div className="flex flex-col gap-1.5 medium:flex-row medium:items-end medium:justify-between medium:gap-4">
					<div className="min-w-0">
						<h1 className="text-balance font-semibold text-3xl tracking-tight text-foreground">
							Assignments
						</h1>
						<PageHeaderSubtext variant="wrap" className="mt-1.5">
							Teacher tests in three columns: start in To do, continue in In progress, then track
							submission and grades in Graded.
						</PageHeaderSubtext>
					</div>
					{open.length > 0 ? (
						<Button
							variant="outline"
							size="sm"
							className="w-full shrink-0 medium:w-auto"
							render={<Link href="/student/practice" />}
						>
							Practice on your own
						</Button>
					) : null}
				</div>
				{hasUrgent ? (
					<p className="text-sm text-muted-foreground" role="note">
						{summary.overdue > 0 ? (
							<span className="font-medium text-destructive">{summary.overdue} overdue</span>
						) : null}
						{summary.overdue > 0 && summary.dueSoon > 0 ? (
							<span className="text-muted-foreground"> · </span>
						) : null}
						{summary.dueSoon > 0 ? (
							<span className="font-medium text-amber-800 dark:text-amber-200">
								{summary.dueSoon} due this week
							</span>
						) : null}
					</p>
				) : null}
			</header>
			<AssignmentsKanban assignments={assignments} portal="student" />
		</div>
	);
}
