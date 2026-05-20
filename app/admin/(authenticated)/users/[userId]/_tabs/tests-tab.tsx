import Link from "next/link";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminUserTabPagination } from "@/components/admin/users/admin-user-tab-pagination";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { cn } from "@/lib/utils";

import type { TestsList, UserDetailRow, UserTabPaginationState } from "./types";

interface TestsTabProps {
	row: UserDetailRow;
	userId: string;
	testsList: TestsList | null;
	pagination: UserTabPaginationState;
}

export function TestsTab({ row, userId, testsList, pagination }: TestsTabProps) {
	if (row.role !== "student" || !testsList) {
		return (
			<div className="space-y-3">
				<p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
					Practice test history is stored for students.
				</p>
			</div>
		);
	}

	const exportRows: Record<string, unknown>[] = testsList.rows.map((r) => ({
		id: r.id,
		subject_name: r.subject_name ?? "",
		status: r.status,
		total_score: r.total_score ?? "",
		anomaly_flags: r.anomaly_flags.join(", "),
		updated_at: r.updated_at ?? "",
	}));

	return (
		<div className="space-y-3">
			<AdminServerRowsToolbar
				listId={ADMIN_LIST_ID.usersDetailTests}
				filenameBase={`user-${userId}-tests`}
				headers={["id", "subject_name", "status", "total_score", "anomaly_flags", "updated_at"]}
				rows={exportRows}
			/>
			<p className="text-sm text-muted-foreground">
				Practice tests for this student ({testsList.total} total). Open a row for detail, regrade,
				and refunds.
			</p>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[720px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
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
								Flags
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Updated
							</th>
						</tr>
					</thead>
					<tbody>
						{testsList.rows.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
									No tests
								</td>
							</tr>
						) : (
							testsList.rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
									<td className="px-3 py-2">
										<Link
											href={`/admin/assessments/tests/${r.id}`}
											className="text-primary underline-offset-4 hover:underline"
										>
											<span className="font-medium">{r.subject_name ?? "Test"}</span>{" "}
											<span className="font-mono text-xs text-muted-foreground">
												{r.id.slice(0, 8)}…
											</span>
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
														f === "zero_score"
															? "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100"
															: f === "too_fast"
																? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
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
						)}
					</tbody>
				</table>
			</div>
			<AdminUserTabPagination
				userId={userId}
				tab="tests"
				page={pagination.page}
				pageSize={pagination.pageSize}
				total={testsList.total}
			/>
		</div>
	);
}
