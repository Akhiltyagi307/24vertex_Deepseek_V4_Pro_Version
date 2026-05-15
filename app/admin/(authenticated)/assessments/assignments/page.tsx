import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { adminListAssignments } from "@/lib/admin/assignments-admin";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { cn } from "@/lib/utils";

export const metadata = {
	title: "Admin assignments · EduAI",
	robots: { index: false, follow: false },
};

const PAGE_SIZE = 25;

function buildHref(params: { page?: number; status?: string | null; q?: string | null }) {
	const sp = new URLSearchParams();
	if (params.page && params.page > 1) sp.set("page", String(params.page));
	if (params.status) sp.set("status", params.status);
	if (params.q) sp.set("q", params.q);
	const qs = sp.toString();
	return qs ? `/admin/assessments/assignments?${qs}` : "/admin/assessments/assignments";
}

export default async function AdminAssignmentsListPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const status = sp.status?.trim() || null;
	const q = sp.q?.trim() || null;

	const { rows, total } = await adminListAssignments({ page, pageSize: PAGE_SIZE, status, q });
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const showingTo = Math.min(page * PAGE_SIZE, total);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Assignments" },
				]}
				title="Assignments"
				description="Teacher-created assignments with submission counts. Open a row for detail and submission roster."
			/>

			<form className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm" action="/admin/assessments/assignments">
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium text-muted-foreground">Title</span>
					<input
						name="q"
						defaultValue={q ?? ""}
						placeholder="Search title…"
						className="w-56 rounded-md border border-border bg-background px-2 py-1 text-sm"
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs font-medium text-muted-foreground">Status</span>
					<select
						name="status"
						defaultValue={status ?? ""}
						className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
					>
						<option value="">All</option>
						<option value="published">published</option>
						<option value="archived">archived</option>
						<option value="draft">draft</option>
					</select>
				</label>
				<button
					type="submit"
					className="rounded-md border border-border bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
				>
					Filter
				</button>
				{(q || status) && (
					<Link
						href="/admin/assessments/assignments"
						className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					>
						Clear
					</Link>
				)}
			</form>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.assessmentsAssignments}
					filenameBase="assessments-assignments"
					headers={[
						"id",
						"title",
						"teacher_id",
						"teacher_name",
						"subject_name",
						"status",
						"due_date",
						"submissions_count",
						"updated_at",
					]}
					rows={rows.map((r) => ({
						id: r.id,
						title: r.title,
						teacher_id: r.teacher_id,
						teacher_name: r.teacher_name ?? "",
						subject_name: r.subject_name ?? "",
						status: r.status ?? "",
						due_date: r.due_date ?? "",
						submissions_count: r.submissions_count,
						updated_at: r.updated_at ?? "",
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[860px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Title</th>
							<th className="px-3 py-2 font-medium">Subject</th>
							<th className="px-3 py-2 font-medium">Teacher</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Due</th>
							<th className="px-3 py-2 font-medium">Submissions</th>
							<th className="px-3 py-2 font-medium">Updated</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
									No assignments match the current filters.
								</td>
							</tr>
						:	rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
									<td className="px-3 py-2">
										<Link
											href={`/admin/assessments/assignments/${r.id}`}
											className="text-primary underline-offset-4 hover:underline"
										>
											{r.title}
										</Link>
									</td>
									<td className="px-3 py-2">{r.subject_name ?? "—"}</td>
									<td className="px-3 py-2">
										<Link
											href={`/admin/users/${r.teacher_id}`}
											className="text-primary underline-offset-4 hover:underline"
										>
											{r.teacher_name ?? r.teacher_id.slice(0, 8)}
										</Link>
									</td>
									<td className="px-3 py-2">
										<span
											className={cn(
												"rounded px-1.5 py-0.5 text-xs",
												r.status === "published" ?
													"bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
												: r.status === "archived" ?
													"bg-muted text-muted-foreground"
												:	"bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
											)}
										>
											{r.status ?? "—"}
										</span>
									</td>
									<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
										{r.due_date ? r.due_date.slice(0, 10) : "—"}
									</td>
									<td className="px-3 py-2 tabular-nums">{r.submissions_count}</td>
									<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
										{r.updated_at ? r.updated_at.slice(0, 16).replace("T", " ") : "—"}
									</td>
								</tr>
							))
						}
					</tbody>
				</table>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
				<span>
					Showing {showingFrom}-{showingTo} of {total.toLocaleString()} (page {page} of {totalPages})
				</span>
				<div className="flex items-center gap-2">
					{page > 1 ?
						<Link href={buildHref({ page: page - 1, status, q })} className="rounded-md border border-border px-2 py-1 hover:bg-muted">
							← Prev
						</Link>
					:	<span className="rounded-md border border-border/50 px-2 py-1 text-muted-foreground/50">← Prev</span>
					}
					{page < totalPages ?
						<Link href={buildHref({ page: page + 1, status, q })} className="rounded-md border border-border px-2 py-1 hover:bg-muted">
							Next →
						</Link>
					:	<span className="rounded-md border border-border/50 px-2 py-1 text-muted-foreground/50">Next →</span>
					}
				</div>
			</div>
		</div>
	);
}
