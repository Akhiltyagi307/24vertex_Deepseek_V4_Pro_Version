import Link from "next/link";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatTrackerStatusFromRaw } from "@/lib/student/tracker-status-labels";

import type { PerformanceRow, UserDetailRow, UserDetailStats } from "./types";

interface PerformanceTabProps {
	row: UserDetailRow;
	userId: string;
	perfPreview: PerformanceRow[];
	stats: UserDetailStats;
}

export function PerformanceTab({ row, userId, perfPreview, stats }: PerformanceTabProps) {
	const exportRows: Record<string, unknown>[] = perfPreview.map((r) => ({
		id: r.id,
		subject_name: r.subjectName,
		topic_name: r.topicName,
		status: formatTrackerStatusFromRaw(r.status),
		average_score: r.averageScore ?? "",
		tests_taken: r.testsTaken ?? "",
	}));
	if (row.role !== "student") {
		return (
			<div className="space-y-4 rounded-lg border border-border p-4 text-sm">
				<p className="text-muted-foreground">Performance tracker applies to students.</p>
			</div>
		);
	}
	return (
		<div className="space-y-4 rounded-lg border border-border p-4 text-sm">
			<AdminServerRowsToolbar
				listId={ADMIN_LIST_ID.usersDetailPerformance}
				filenameBase={`user-${userId}-performance-preview`}
				headers={["id", "subject_name", "topic_name", "status", "average_score", "tests_taken"]}
				rows={exportRows}
			/>
			<p>
				Tracker rows:{" "}
				<span className="font-medium tabular-nums">{stats.performanceTrackerRows}</span>. Open
				the full matrix to edit or run recalculation tools.
			</p>
			<Link
				className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
				href={`/admin/performance/tracker?student=${encodeURIComponent(userId)}`}
			>
				Open performance tracker
			</Link>
			{perfPreview.length > 0 ? (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[640px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th scope="col" className="px-3 py-2 font-medium">
									Subject
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Topic
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Status
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Avg
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Tests
								</th>
							</tr>
						</thead>
						<tbody>
							{perfPreview.map((r) => (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-3 py-2">{r.subjectName}</td>
									<td className="px-3 py-2">{r.topicName}</td>
									<td className="px-3 py-2">{formatTrackerStatusFromRaw(r.status)}</td>
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
			) : (
				<p className="text-muted-foreground">No tracker rows yet.</p>
			)}
		</div>
	);
}
