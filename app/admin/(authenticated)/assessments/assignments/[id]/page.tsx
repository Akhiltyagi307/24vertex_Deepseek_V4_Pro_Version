import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { formatRelativeTime } from "@/components/student/notifications/relative-time";
import { adminGetAssignmentDetail } from "@/lib/admin/assignments-admin";
import { cn } from "@/lib/utils";

export const metadata = {
	title: "Admin assignment detail · 24Vertex",
	robots: { index: false, follow: false },
};

function fmtDate(iso: string | null): string {
	if (!iso) return "—";
	return iso.slice(0, 16).replace("T", " ");
}

function fmtSeconds(s: number | null): string {
	if (!s || s <= 0) return "—";
	const mins = Math.round(s / 60);
	if (mins < 60) return `${mins} min`;
	const hours = Math.floor(mins / 60);
	const rem = mins % 60;
	return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export default async function AdminAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const bundle = await adminGetAssignmentDetail(id);
	if (!bundle) notFound();

	const { assignment: a, submissions, submissions_total } = bundle;

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Assignments", href: "/admin/assessments/assignments" },
					{ label: "Detail" },
				]}
				title={a.title}
				description={a.description ?? undefined}
			/>

			<section className="rounded-xl border border-border bg-card p-4 shadow-sm">
				<dl className="grid gap-x-6 gap-y-3 text-sm medium:grid-cols-2 xl:grid-cols-3">
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
						<dd className="mt-0.5">
							<span
								className={cn(
									"inline-flex rounded px-1.5 py-0.5 text-xs",
									a.status === "published" ?
										"bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
									: a.status === "archived" ?
										"bg-muted text-muted-foreground"
									:	"bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
								)}
							>
								{a.status ?? "—"}
							</span>
						</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</dt>
						<dd className="mt-0.5">{a.assignment_type ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</dt>
						<dd className="mt-0.5">{a.subject_name ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Teacher</dt>
						<dd className="mt-0.5">
							<Link
								href={`/admin/users/${a.teacher_id}`}
								className="text-primary underline-offset-4 hover:underline"
							>
								{a.teacher_name ?? a.teacher_id.slice(0, 8)}
							</Link>
						</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difficulty</dt>
						<dd className="mt-0.5">{a.difficulty ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question count</dt>
						<dd className="mt-0.5 tabular-nums">{a.question_count ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time limit</dt>
						<dd className="mt-0.5">{fmtSeconds(a.time_limit_seconds)}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due</dt>
						<dd className="mt-0.5 font-mono text-xs">{fmtDate(a.due_date)}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Topics</dt>
						<dd className="mt-0.5 tabular-nums">{a.topic_ids.length}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
						<dd className="mt-0.5 font-mono text-xs">{fmtDate(a.created_at)}</dd>
					</div>
					<div>
						<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</dt>
						<dd className="mt-0.5 font-mono text-xs">{fmtDate(a.updated_at)}</dd>
					</div>
				</dl>

				{a.instructions ?
					<div className="mt-4 border-t border-border pt-3">
						<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Instructions</p>
						<p className="mt-1 whitespace-pre-wrap text-sm">{a.instructions}</p>
					</div>
				:	null}
			</section>

			<section className="space-y-3">
				<div className="flex items-end justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Submissions</h2>
						<p className="text-xs text-muted-foreground">
							{submissions_total.toLocaleString()} total · showing {submissions.length} most recent
						</p>
					</div>
				</div>
				{submissions.length === 0 ?
					<p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
						No submissions yet.
					</p>
				:	<div className="overflow-x-auto rounded-md border border-border">
						<table className="w-full min-w-[760px] text-left text-sm">
							<thead className="border-b border-border bg-muted/40">
								<tr>
									<th className="px-3 py-2 font-medium">Student</th>
									<th className="px-3 py-2 font-medium">Status</th>
									<th className="px-3 py-2 font-medium">Score</th>
									<th className="px-3 py-2 font-medium">Late</th>
									<th className="px-3 py-2 font-medium">Submitted</th>
									<th className="px-3 py-2 font-medium">Test</th>
								</tr>
							</thead>
							<tbody>
								{submissions.map((s) => (
									<tr key={s.id} className="border-b border-border/80 hover:bg-muted/30">
										<td className="px-3 py-2">
											<Link
												href={`/admin/users/${s.student_id}`}
												className="text-primary underline-offset-4 hover:underline"
											>
												{s.student_name ?? s.student_id.slice(0, 8)}
											</Link>
										</td>
										<td className="px-3 py-2">{s.status ?? "—"}</td>
										<td className="px-3 py-2 tabular-nums">{s.score ?? "—"}</td>
										<td className="px-3 py-2">{s.is_late ? "yes" : "no"}</td>
										<td
											className="px-3 py-2 font-mono text-xs text-muted-foreground"
											title={s.submitted_at ?? undefined}
										>
											{s.submitted_at ? formatRelativeTime(s.submitted_at) : "—"}
										</td>
										<td className="px-3 py-2">
											{s.test_id ?
												<Link
													href={`/admin/assessments/tests/${s.test_id}`}
													className="font-mono text-xs text-primary underline-offset-4 hover:underline"
												>
													Open
												</Link>
											:	"—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				}
			</section>

			<p className="text-sm">
				<Link href="/admin/assessments/assignments" className="text-primary underline-offset-4 hover:underline">
					← Back to assignments
				</Link>
			</p>
		</div>
	);
}
