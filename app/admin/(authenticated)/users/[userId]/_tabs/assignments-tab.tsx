import Link from "next/link";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminUserTabPagination } from "@/components/admin/users/admin-user-tab-pagination";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

import type {
	StudentAssignments,
	TeacherAssignments,
	UserDetailRow,
	UserTabPaginationState,
} from "./types";

interface AssignmentsTabProps {
	row: UserDetailRow;
	userId: string;
	studentAssignments: StudentAssignments | null;
	teacherAssignments: TeacherAssignments | null;
	pagination: UserTabPaginationState;
}

export function AssignmentsTab({
	row,
	userId,
	studentAssignments,
	teacherAssignments,
	pagination,
}: AssignmentsTabProps) {
	if (row.role === "student" && studentAssignments) {
		const exportRows: Record<string, unknown>[] = studentAssignments.rows.map((r) => ({
			submission_id: r.submission_id,
			assignment_id: r.assignment_id,
			assignment_title: r.assignment_title,
			subject_name: r.subject_name ?? "",
			status: r.status,
			score: r.score ?? "",
			is_late: r.is_late,
			test_id: r.test_id ?? "",
		}));
		return (
			<div className="space-y-3">
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.usersDetailAssignmentsStudent}
					filenameBase={`user-${userId}-assignments-student`}
					headers={[
						"submission_id",
						"assignment_id",
						"assignment_title",
						"subject_name",
						"status",
						"score",
						"is_late",
						"test_id",
					]}
					rows={exportRows}
				/>
				<p className="text-sm text-muted-foreground">
					Submissions for this student ({studentAssignments.total} total).
				</p>
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[800px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th scope="col" className="px-3 py-2 font-medium">
									Assignment
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Subject
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Status
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Score
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Late
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Test
								</th>
							</tr>
						</thead>
						<tbody>
							{studentAssignments.rows.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
										No submissions
									</td>
								</tr>
							) : (
								studentAssignments.rows.map((r) => (
									<tr
										key={r.submission_id}
										className="border-b border-border/80 hover:bg-muted/30"
									>
										<td className="px-3 py-2">
											<Link
												className="text-primary underline-offset-4 hover:underline"
												href={`/admin/assessments/assignments/${r.assignment_id}`}
											>
												{r.assignment_title}
											</Link>
										</td>
										<td className="px-3 py-2">{r.subject_name ?? "—"}</td>
										<td className="px-3 py-2">{r.status}</td>
										<td className="px-3 py-2 tabular-nums">{r.score ?? "—"}</td>
										<td className="px-3 py-2">{r.is_late ? "Yes" : "No"}</td>
										<td className="px-3 py-2">
											{r.test_id ? (
												<Link
													className="font-mono text-xs text-primary underline-offset-4 hover:underline"
													href={`/admin/assessments/tests/${r.test_id}`}
												>
													Open
												</Link>
											) : (
												"—"
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				<AdminUserTabPagination
					userId={userId}
					tab="assignments"
					page={pagination.page}
					pageSize={pagination.pageSize}
					total={studentAssignments.total}
				/>
			</div>
		);
	}

	if (row.role === "teacher" && teacherAssignments) {
		const exportRows: Record<string, unknown>[] = teacherAssignments.rows.map((r) => ({
			id: r.id,
			title: r.title,
			subject_name: r.subject_name ?? "",
			status: r.status,
			due_date: r.due_date ?? "",
		}));
		return (
			<div className="space-y-3">
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.usersDetailAssignmentsTeacher}
					filenameBase={`user-${userId}-assignments-teacher`}
					headers={["id", "title", "subject_name", "status", "due_date"]}
					rows={exportRows}
				/>
				<p className="text-sm text-muted-foreground">
					Assignments created by this teacher ({teacherAssignments.total} total).
				</p>
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[640px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th scope="col" className="px-3 py-2 font-medium">
									Title
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Subject
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Status
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Due
								</th>
							</tr>
						</thead>
						<tbody>
							{teacherAssignments.rows.length === 0 ? (
								<tr>
									<td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
										No assignments
									</td>
								</tr>
							) : (
								teacherAssignments.rows.map((r) => (
									<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
										<td className="px-3 py-2">
											<Link
												className="text-primary underline-offset-4 hover:underline"
												href={`/admin/assessments/assignments/${r.id}`}
											>
												{r.title}
											</Link>
										</td>
										<td className="px-3 py-2">{r.subject_name ?? "—"}</td>
										<td className="px-3 py-2">{r.status}</td>
										<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
											{r.due_date ? formatDateTimeMediumShortInAppTimeZone(r.due_date) : "—"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				<AdminUserTabPagination
					userId={userId}
					tab="assignments"
					page={pagination.page}
					pageSize={pagination.pageSize}
					total={teacherAssignments.total}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
				{row.role === "parent"
					? "Assignment submissions apply to students. Use linked students on the Profile tab."
					: "No assignment data for this role."}
			</p>
		</div>
	);
}
