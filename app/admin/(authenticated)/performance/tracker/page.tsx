import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { adminListPerformanceRows } from "@/lib/admin/performance-admin";
import { formatTrackerStatusFromRaw } from "@/lib/student/tracker-status-labels";

export const metadata = {
	title: "Admin performance tracker · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminPerformanceTrackerPage({
	searchParams,
}: {
	searchParams: Promise<{ student?: string }>;
}) {
	await requireAdmin();
	const sp = await searchParams;
	const studentId = sp.student?.trim();
	const rows = studentId ? await adminListPerformanceRows(studentId) : [];

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Performance", href: "/admin/performance/tracker" },
					{ label: "Tracker" },
				]}
				title="Performance tracker"
				description="Pass ?student=&lt;uuid&gt; to load matrix (same data as API)."
			/>
			{!studentId ?
				<p className="text-sm text-muted-foreground">
					Example:{" "}
					<Link className="text-primary underline-offset-2 hover:underline" href="/admin/users/students">
						find a student
					</Link>{" "}
					then open{" "}
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/admin/performance/tracker?student=UUID</code>
					. For grade-wide re-init jobs, use{" "}
					<Link className="text-primary underline-offset-2 hover:underline" href="/admin/performance/tools">
						Performance tools
					</Link>
					.
				</p>
			:	null}
			{studentId && rows.length === 0 ?
				<p className="text-sm text-muted-foreground">No tracker rows for this student.</p>
			:	null}
			{rows.length > 0 ?
				<Suspense fallback={null}>
					<AdminServerRowsToolbar
						listId={ADMIN_LIST_ID.performanceTracker}
						filenameBase={`performance-tracker-${studentId}`}
						headers={["id", "topic_id", "subject_id", "subject_name", "topic_name", "status", "average_score", "tests_taken", "trend"]}
						rows={rows.map((r) => ({
							id: r.id,
							topic_id: r.topicId,
							subject_id: r.subjectId,
							subject_name: r.subjectName,
							topic_name: r.topicName,
							status: formatTrackerStatusFromRaw(r.status),
							average_score: r.averageScore ?? "",
							tests_taken: r.testsTaken ?? "",
							trend: r.trend ?? "",
						}))}
					/>
				</Suspense>
			:	null}
			{rows.length > 0 ?
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[800px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th className="px-2 py-1.5">Subject</th>
								<th className="px-2 py-1.5">Topic</th>
								<th className="px-2 py-1.5">Status</th>
								<th className="px-2 py-1.5">Avg</th>
								<th className="px-2 py-1.5">Tests</th>
								<th className="px-2 py-1.5">Trend</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id} className="border-b border-border/70">
									<td className="px-2 py-1.5">{r.subjectName}</td>
									<td className="px-2 py-1.5">{r.topicName}</td>
									<td className="px-2 py-1.5">{formatTrackerStatusFromRaw(r.status)}</td>
									<td className="px-2 py-1.5 tabular-nums">{r.averageScore ?? "—"}</td>
									<td className="px-2 py-1.5 tabular-nums">{r.testsTaken ?? "—"}</td>
									<td className="px-2 py-1.5">{r.trend}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			:	null}
		</div>
	);
}
