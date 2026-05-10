import Link from "next/link";
import { notFound } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import { desc, eq } from "drizzle-orm";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { DeadlineBadge } from "@/components/admin/compliance/deadline-badge";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminUserDangerZone } from "@/components/admin/users/admin-user-danger-zone";
import { AdminUserTabPagination } from "@/components/admin/users/admin-user-tab-pagination";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { adminListPerformanceRows } from "@/lib/admin/performance-admin";
import { adminListTests } from "@/lib/admin/tests-admin";
import {
	adminListAssignmentSubmissionsForStudent,
	adminListAssignmentsForTeacher,
	adminListLinkedStudentsForParent,
	adminListNotificationsForUser,
} from "@/lib/admin/user-detail-lists";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { getAdminUserDetailStats } from "@/lib/admin/user-detail-queries";
import { adminGetUserById } from "@/lib/admin/users-list";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

export const metadata = {
	title: "Admin user · EduAI",
	robots: { index: false, follow: false },
};

const tabs = ["profile", "performance", "tests", "assignments", "notifications", "sessions", "audit", "compliance"] as const;
type Tab = (typeof tabs)[number];

function isTab(v: string | undefined): v is Tab {
	return !!v && (tabs as readonly string[]).includes(v);
}

export default async function AdminUserDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ userId: string }>;
	searchParams: Promise<{ tab?: string; page?: string }>;
}) {
	const { userId } = await params;
	const sp = await searchParams;
	const tab: Tab = isTab(sp.tab) ? sp.tab : "profile";
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const pageSize = 25;

	const row = await adminGetUserById(userId);
	if (!row) notFound();

	const totpRequired = await isAdminTotpRequired();
	const stats = await getAdminUserDetailStats(userId, row.role);

	const linkedStudents =
		row.role === "parent" && tab === "profile" ? await adminListLinkedStudentsForParent(userId) : [];

	let testsList: Awaited<ReturnType<typeof adminListTests>> | null = null;
	if (tab === "tests" && row.role === "student") {
		testsList = await adminListTests({
			page,
			pageSize,
			studentId: userId,
			status: null,
			q: null,
		});
	}

	let assignmentSubmissions: Awaited<ReturnType<typeof adminListAssignmentSubmissionsForStudent>> | null = null;
	let teacherAssignments: Awaited<ReturnType<typeof adminListAssignmentsForTeacher>> | null = null;
	if (tab === "assignments" && row.role === "student") {
		assignmentSubmissions = await adminListAssignmentSubmissionsForStudent(userId, page, pageSize);
	}
	if (tab === "assignments" && row.role === "teacher") {
		teacherAssignments = await adminListAssignmentsForTeacher(userId, page, pageSize);
	}

	let notificationsList: Awaited<ReturnType<typeof adminListNotificationsForUser>> | null = null;
	if (tab === "notifications") {
		notificationsList = await adminListNotificationsForUser(userId, page, pageSize);
	}

	let perfPreview: Awaited<ReturnType<typeof adminListPerformanceRows>> = [];
	if (tab === "performance" && row.role === "student") {
		const all = await adminListPerformanceRows(userId);
		perfPreview = all.slice(0, 15);
	}

	let complianceDsrs: InferSelectModel<typeof complianceRequests>[] = [];
	if (tab === "compliance") {
		complianceDsrs = await db
			.select()
			.from(complianceRequests)
			.where(eq(complianceRequests.subjectUserId, userId))
			.orderBy(desc(complianceRequests.createdAt))
			.limit(50);
	}

	const testsExportRows: Record<string, unknown>[] =
		testsList?.rows.map((r) => ({
			id: r.id,
			subject_name: r.subject_name ?? "",
			status: r.status,
			total_score: r.total_score ?? "",
			anomaly_flags: r.anomaly_flags.join(", "),
			updated_at: r.updated_at ?? "",
		})) ?? [];

	const assignmentSubmissionsExportRows: Record<string, unknown>[] =
		assignmentSubmissions?.rows.map((r) => ({
			submission_id: r.submission_id,
			assignment_id: r.assignment_id,
			assignment_title: r.assignment_title,
			subject_name: r.subject_name ?? "",
			status: r.status,
			score: r.score ?? "",
			is_late: r.is_late,
			test_id: r.test_id ?? "",
		})) ?? [];

	const teacherAssignmentsExportRows: Record<string, unknown>[] =
		teacherAssignments?.rows.map((r) => ({
			id: r.id,
			title: r.title,
			subject_name: r.subject_name ?? "",
			status: r.status,
			due_date: r.due_date ?? "",
		})) ?? [];

	const notificationsExportRows: Record<string, unknown>[] =
		notificationsList?.rows.map((r) => ({
			id: r.id,
			created_at: r.created_at ?? "",
			type: r.type,
			title: r.title,
			body_preview: r.body_preview,
			is_read: r.is_read,
			email_sent: r.email_sent,
		})) ?? [];

	const performanceExportRows: Record<string, unknown>[] = perfPreview.map((r) => ({
		id: r.id,
		subject_name: r.subjectName,
		topic_name: r.topicName,
		status: r.status,
		average_score: r.averageScore ?? "",
		tests_taken: r.testsTaken ?? "",
	}));

	const usersListHref =
		row.role === "parent" ? "/admin/users/parents"
		: row.role === "teacher" ? "/admin/users/teachers"
		: "/admin/users/students";

	const tabLink = (id: Tab, label: string) => {
		const active = tab === id;
		return (
			<Link
				key={id}
				className={cn(
					"rounded-md border px-3 py-1.5",
					active ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted",
				)}
				href={`/admin/users/${userId}?tab=${id}`}
			>
				{label}
			</Link>
		);
	};

	const auditHref = `/admin/audit?targetId=${encodeURIComponent(userId)}`;

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Users", href: usersListHref },
					{ label: row.full_name },
				]}
				title={row.full_name}
				description={row.email ?? "No email"}
			/>

			<div className="flex flex-wrap gap-2 text-sm">
				{tabLink("profile", "Profile")}
				{tabLink("performance", "Performance")}
				{tabLink("tests", "Tests")}
				{tabLink("assignments", "Assignments")}
				{tabLink("notifications", "Notifications")}
				{tabLink("sessions", "Sessions")}
				{tabLink("audit", "Audit log")}
				{tabLink("compliance", "Compliance")}
			</div>

			{tab === "profile" ?
				<div className="space-y-6">
					<div className="grid gap-4 rounded-lg border border-border p-4 medium:grid-cols-2">
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Role</h2>
							<p className="mt-1">{row.role}</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Grade / section</h2>
							<p className="mt-1">
								{row.grade ?? "—"} / {row.section ?? "—"}
							</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Stream</h2>
							<p className="mt-1">{row.stream ?? "—"}</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Verified</h2>
							<p className="mt-1">{row.is_verified ? "Yes" : "No"}</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Suspended</h2>
							<p className="mt-1">{row.is_suspended ? "Yes" : "No"}</p>
						</div>
						{row.is_suspended || row.suspended_reason ?
							<div className="medium:col-span-2">
								<h2 className="text-sm font-medium text-muted-foreground">Suspension</h2>
								<p className="mt-1 text-sm">
									{row.suspended_at ? <span className="text-muted-foreground">Since {row.suspended_at} · </span> : null}
									{row.suspended_reason ?? "—"}
								</p>
							</div>
						:	null}
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Deleted</h2>
							<p className="mt-1">{row.deleted_at ? row.deleted_at : "No"}</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Phone</h2>
							<p className="mt-1">{row.phone ?? "—"}</p>
						</div>
						<div className="medium:col-span-2">
							<h2 className="text-sm font-medium text-muted-foreground">School</h2>
							<p className="mt-1">{row.school_name ?? "—"}</p>
						</div>
						<div>
							<h2 className="text-sm font-medium text-muted-foreground">Last active</h2>
							<p className="mt-1">{row.last_active_at ?? "—"}</p>
						</div>
					</div>

					{row.role === "parent" && linkedStudents.length > 0 ?
						<div className="rounded-lg border border-border p-4">
							<h2 className="text-sm font-semibold">Linked students</h2>
							<ul className="mt-3 space-y-2 text-sm">
								{linkedStudents.map((s) => (
									<li key={s.student_id} className="flex flex-wrap items-baseline gap-2">
										<Link
											className="font-medium text-primary underline-offset-4 hover:underline"
											href={`/admin/users/${s.student_id}`}
										>
											{s.full_name}
										</Link>
										<span className="text-muted-foreground">
											{s.grade ?? "—"} / {s.section ?? "—"} · {s.link_status ?? "—"}
											{s.linked_at ? ` · linked ${s.linked_at}` : ""}
										</span>
									</li>
								))}
							</ul>
						</div>
					:	null}
					{row.role === "parent" && linkedStudents.length === 0 ?
						<p className="text-sm text-muted-foreground">No linked student profiles for this parent.</p>
					:	null}
				</div>
			:	null}

			{tab === "performance" ?
				<div className="space-y-4 rounded-lg border border-border p-4 text-sm">
					{row.role === "student" ?
						<>
							<AdminServerRowsToolbar
								listId={ADMIN_LIST_ID.usersDetailPerformance}
								filenameBase={`user-${userId}-performance-preview`}
								headers={["id", "subject_name", "topic_name", "status", "average_score", "tests_taken"]}
								rows={performanceExportRows}
							/>
							<p>
								Tracker rows:{" "}
								<span className="font-medium tabular-nums">{stats.performanceTrackerRows}</span>. Open the full
								matrix to edit or run recalculation tools.
							</p>
							<Link
								className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
								href={`/admin/performance/tracker?student=${encodeURIComponent(userId)}`}
							>
								Open performance tracker
							</Link>
							{perfPreview.length > 0 ?
								<div className="overflow-x-auto rounded-md border border-border">
									<table className="w-full min-w-[640px] text-left text-sm">
										<thead className="border-b border-border bg-muted/40">
											<tr>
												<th className="px-3 py-2 font-medium">Subject</th>
												<th className="px-3 py-2 font-medium">Topic</th>
												<th className="px-3 py-2 font-medium">Status</th>
												<th className="px-3 py-2 font-medium">Avg</th>
												<th className="px-3 py-2 font-medium">Tests</th>
											</tr>
										</thead>
										<tbody>
											{perfPreview.map((r) => (
												<tr key={r.id} className="border-b border-border/80">
													<td className="px-3 py-2">{r.subjectName}</td>
													<td className="px-3 py-2">{r.topicName}</td>
													<td className="px-3 py-2">{r.status}</td>
													<td className="px-3 py-2 tabular-nums">{r.averageScore ?? "—"}</td>
													<td className="px-3 py-2 tabular-nums">{r.testsTaken ?? "—"}</td>
												</tr>
											))}
										</tbody>
									</table>
									<p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
										Showing first {perfPreview.length} of {stats.performanceTrackerRows} rows.
									</p>
								</div>
							:	<p className="text-muted-foreground">No tracker rows yet.</p>}
						</>
					:	<p className="text-muted-foreground">Performance tracker applies to students.</p>}
				</div>
			:	null}

			{tab === "tests" ?
				<div className="space-y-3">
					{row.role === "student" && testsList ?
						<>
							<AdminServerRowsToolbar
								listId={ADMIN_LIST_ID.usersDetailTests}
								filenameBase={`user-${userId}-tests`}
								headers={["id", "subject_name", "status", "total_score", "anomaly_flags", "updated_at"]}
								rows={testsExportRows}
							/>
							<p className="text-sm text-muted-foreground">
								Practice tests for this student ({testsList.total} total). Open a row for detail, regrade, and
								refunds.
							</p>
							<div className="overflow-x-auto rounded-md border border-border">
								<table className="w-full min-w-[720px] text-left text-sm">
									<thead className="border-b border-border bg-muted/40">
										<tr>
											<th className="px-3 py-2 font-medium">Subject</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Score</th>
											<th className="px-3 py-2 font-medium">Flags</th>
											<th className="px-3 py-2 font-medium">Updated</th>
										</tr>
									</thead>
									<tbody>
										{testsList.rows.length === 0 ?
											<tr>
												<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
													No tests
												</td>
											</tr>
										:	testsList.rows.map((r) => (
												<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
													<td className="px-3 py-2">
														<Link
															href={`/admin/assessments/tests/${r.id}`}
															className="text-primary underline-offset-4 hover:underline"
														>
															<span className="font-medium">{r.subject_name ?? "Test"}</span>{" "}
															<span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}…</span>
														</Link>
													</td>
													<td className="px-3 py-2">{r.status}</td>
													<td className="px-3 py-2 tabular-nums">{r.total_score ?? "—"}</td>
													<td className="px-3 py-2">
														<div className="flex flex-wrap gap-1">
															{r.anomaly_flags.map((f) => (
																<span
																	key={f}
																	className={cn(
																		"rounded px-1.5 py-0.5 text-xs",
																		f === "zero_score" ?
																			"bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100"
																		: f === "too_fast" ?
																			"bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
																		: "bg-muted text-muted-foreground",
																	)}
																>
																	{f}
																</span>
															))}
														</div>
													</td>
													<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
														{r.updated_at ? formatDateTimeMediumShortInAppTimeZone(r.updated_at) : "—"}
													</td>
												</tr>
											))
										}
									</tbody>
								</table>
							</div>
							<AdminUserTabPagination
								userId={userId}
								tab="tests"
								page={page}
								pageSize={pageSize}
								total={testsList.total}
							/>
						</>
					:	<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
							Practice test history is stored for students.
						</p>}
				</div>
			:	null}

			{tab === "assignments" ?
				<div className="space-y-3">
					{row.role === "student" && assignmentSubmissions ?
						<>
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
								rows={assignmentSubmissionsExportRows}
							/>
							<p className="text-sm text-muted-foreground">
								Submissions for this student ({assignmentSubmissions.total} total).
							</p>
							<div className="overflow-x-auto rounded-md border border-border">
								<table className="w-full min-w-[800px] text-left text-sm">
									<thead className="border-b border-border bg-muted/40">
										<tr>
											<th className="px-3 py-2 font-medium">Assignment</th>
											<th className="px-3 py-2 font-medium">Subject</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Score</th>
											<th className="px-3 py-2 font-medium">Late</th>
											<th className="px-3 py-2 font-medium">Test</th>
										</tr>
									</thead>
									<tbody>
										{assignmentSubmissions.rows.length === 0 ?
											<tr>
												<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
													No submissions
												</td>
											</tr>
										:	assignmentSubmissions.rows.map((r) => (
												<tr key={r.submission_id} className="border-b border-border/80 hover:bg-muted/30">
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
														{r.test_id ?
															<Link
																className="font-mono text-xs text-primary underline-offset-4 hover:underline"
																href={`/admin/assessments/tests/${r.test_id}`}
															>
																Open
															</Link>
														:	"—"}
													</td>
												</tr>
											))
										}
									</tbody>
								</table>
							</div>
							<AdminUserTabPagination
								userId={userId}
								tab="assignments"
								page={page}
								pageSize={pageSize}
								total={assignmentSubmissions.total}
							/>
						</>
					: row.role === "teacher" && teacherAssignments ?
						<>
							<AdminServerRowsToolbar
								listId={ADMIN_LIST_ID.usersDetailAssignmentsTeacher}
								filenameBase={`user-${userId}-assignments-teacher`}
								headers={["id", "title", "subject_name", "status", "due_date"]}
								rows={teacherAssignmentsExportRows}
							/>
							<p className="text-sm text-muted-foreground">
								Assignments created by this teacher ({teacherAssignments.total} total).
							</p>
							<div className="overflow-x-auto rounded-md border border-border">
								<table className="w-full min-w-[640px] text-left text-sm">
									<thead className="border-b border-border bg-muted/40">
										<tr>
											<th className="px-3 py-2 font-medium">Title</th>
											<th className="px-3 py-2 font-medium">Subject</th>
											<th className="px-3 py-2 font-medium">Status</th>
											<th className="px-3 py-2 font-medium">Due</th>
										</tr>
									</thead>
									<tbody>
										{teacherAssignments.rows.length === 0 ?
											<tr>
												<td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
													No assignments
												</td>
											</tr>
										:	teacherAssignments.rows.map((r) => (
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
										}
									</tbody>
								</table>
							</div>
							<AdminUserTabPagination
								userId={userId}
								tab="assignments"
								page={page}
								pageSize={pageSize}
								total={teacherAssignments.total}
							/>
						</>
					:	<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
							{row.role === "parent" ?
								"Assignment submissions apply to students. Use linked students on the Profile tab."
							:	"No assignment data for this role."}
						</p>}
				</div>
			:	null}

			{tab === "notifications" && notificationsList ?
				<div className="space-y-3">
					<AdminServerRowsToolbar
						listId={ADMIN_LIST_ID.usersDetailNotifications}
						filenameBase={`user-${userId}-notifications`}
						headers={["id", "created_at", "type", "title", "body_preview", "is_read", "email_sent"]}
						rows={notificationsExportRows}
					/>
					<p className="text-sm text-muted-foreground">
						In-app notifications ({notificationsList.total} total). Body is truncated for the operator table.
					</p>
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full min-w-[880px] text-left text-sm">
							<thead className="border-b border-border bg-muted/40">
								<tr>
									<th className="px-3 py-2 font-medium">When</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium">Title</th>
									<th className="px-3 py-2 font-medium">Preview</th>
									<th className="px-3 py-2 font-medium">Read</th>
									<th className="px-3 py-2 font-medium">Email</th>
								</tr>
							</thead>
							<tbody>
								{notificationsList.rows.length === 0 ?
									<tr>
										<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
											No notifications
										</td>
									</tr>
								:	notificationsList.rows.map((r) => (
										<tr key={r.id} className="border-b border-border/80 align-top">
											<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
												{r.created_at ? formatDateTimeMediumShortInAppTimeZone(r.created_at) : "—"}
											</td>
											<td className="px-3 py-2">{r.type}</td>
											<td className="px-3 py-2">{r.title}</td>
											<td className="max-w-[280px] px-3 py-2 text-muted-foreground">{r.body_preview}</td>
											<td className="px-3 py-2">{r.is_read ? "Yes" : "No"}</td>
											<td className="px-3 py-2 text-xs">
												{r.email_sent ?
													`Yes${
														r.email_sent_at ?
															` · ${formatDateTimeMediumShortInAppTimeZone(r.email_sent_at)}`
														:	""
													}`
												:	"No"}
											</td>
										</tr>
									))
								}
							</tbody>
						</table>
					</div>
					<AdminUserTabPagination
						userId={userId}
						tab="notifications"
						page={page}
						pageSize={pageSize}
						total={notificationsList.total}
					/>
				</div>
			:	null}

			{tab === "sessions" ?
				<div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
					<p>
						End-user sessions are issued by Supabase Auth (refresh tokens). Inspect or revoke them from the Supabase
						dashboard for now. A first-class session list is planned for a later admin phase.
					</p>
				</div>
			:	null}

			{tab === "audit" ?
				<div className="rounded-lg border border-border p-4 text-sm">
					<p className="text-muted-foreground">
						Operator actions that set <code className="text-xs">target_id</code> to this profile id appear in the
						filtered audit view. Some actions may log a different target (e.g. test id); use the full audit log and
						correlate by time if needed.
					</p>
					<Link className="mt-3 inline-block text-primary text-sm font-medium underline-offset-4 hover:underline" href={auditHref}>
						Open audit log for this user id
					</Link>
				</div>
			:	null}

			{tab === "compliance" ?
				<div className="space-y-3 rounded-lg border border-border p-4 text-sm">
					<p className="text-muted-foreground">Data subject requests where this user is the subject.</p>
					<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full min-w-[640px] text-left text-sm">
							<thead className="border-b border-border bg-muted/40">
								<tr>
									<th className="px-3 py-2 font-medium">Request</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium">Status</th>
									<th className="px-3 py-2 font-medium">Due</th>
								</tr>
							</thead>
							<tbody>
								{complianceDsrs.length === 0 ?
									<tr>
										<td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
											No DSRs for this user
										</td>
									</tr>
								:	complianceDsrs.map((r) => (
										<tr key={r.id} className="border-b border-border/80">
											<td className="px-3 py-2">
												<Link className="text-primary underline" href={`/admin/compliance/requests/${r.id}`}>
													{r.id.slice(0, 8)}…
												</Link>
											</td>
											<td className="px-3 py-2">{r.requestType}</td>
											<td className="px-3 py-2">{r.status}</td>
											<td className="px-3 py-2">
												<DeadlineBadge dueAt={r.dueAt} />
											</td>
										</tr>
									))
								}
							</tbody>
						</table>
					</div>
					<Link className="text-primary text-sm underline" href="/admin/compliance/requests">
						Open compliance queue
					</Link>
				</div>
			:	null}

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Danger zone</h2>
				<AdminUserDangerZone userId={row.id} email={row.email} totpRequired={totpRequired} />
			</section>
		</div>
	);
}
