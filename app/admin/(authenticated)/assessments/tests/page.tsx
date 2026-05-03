import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { requireAdmin } from "@/lib/admin/guards";
import { adminListTests } from "@/lib/admin/tests-admin";
import { cn } from "@/lib/utils";

export const metadata = {
	title: "Admin tests · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminTestsListPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
	await requireAdmin();
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const { rows, total } = await adminListTests({
		page,
		pageSize: 25,
		status: sp.status ?? null,
		q: sp.q ?? null,
	});

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Tests" },
				]}
				title="Tests"
				description="Practice tests with anomaly flags. Open a row for detail, regrade, and refunds."
			/>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.assessmentsTests}
					filenameBase="assessments-tests"
					headers={["id", "student_id", "student_name", "subject_name", "status", "total_score", "anomaly_flags", "updated_at"]}
					rows={rows.map((r) => ({
						id: r.id,
						student_id: r.student_id,
						student_name: r.student_name ?? "",
						subject_name: r.subject_name ?? "",
						status: r.status ?? "",
						total_score: r.total_score ?? "",
						anomaly_flags: r.anomaly_flags.join(";"),
						updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : "",
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[720px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Student</th>
							<th className="px-3 py-2 font-medium">Subject</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Score</th>
							<th className="px-3 py-2 font-medium">Flags</th>
							<th className="px-3 py-2 font-medium">Updated</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
									No rows
								</td>
							</tr>
						:	rows.map((r) => (
								<tr key={r.id} className="border-b border-border/80 hover:bg-muted/30">
									<td className="px-3 py-2">
										<Link href={`/admin/assessments/tests/${r.id}`} className="font-mono text-xs text-primary underline-offset-4 hover:underline">
											{r.student_name ?? r.student_id.slice(0, 8)}
										</Link>
									</td>
									<td className="px-3 py-2">{r.subject_name ?? "—"}</td>
									<td className="px-3 py-2">{r.status}</td>
									<td className="px-3 py-2 tabular-nums">{r.total_score ?? "—"}</td>
									<td className="px-3 py-2">
										<div className="flex flex-wrap gap-1">
											{r.anomaly_flags.map((f) => (
												<span
													key={f}
													className={cn(
														"rounded px-1.5 py-0.5 text-xs",
														f === "zero_score" ? "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100"
														: f === "too_fast" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
														: "bg-muted text-muted-foreground",
													)}
												>
													{f}
												</span>
											))}
										</div>
									</td>
									<td className="px-3 py-2 font-mono text-xs text-muted-foreground">
										{r.updated_at ? new Date(r.updated_at).toISOString() : "—"}
									</td>
								</tr>
							))
						}
					</tbody>
				</table>
			</div>
			<p className="text-xs text-muted-foreground">
				Showing {rows.length} of {total} (page {page}). Use API for full pagination controls.
			</p>
		</div>
	);
}
