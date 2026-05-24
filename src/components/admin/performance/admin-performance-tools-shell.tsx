"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminBulkReinitPanel } from "@/components/admin/performance/admin-bulk-reinit-panel";
import { AdminPerformanceGradePresets } from "@/components/admin/performance/admin-performance-grade-presets";
import { Button } from "@/components/ui/button";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

export type RecentOperatorJobRow = {
	id: string;
	queue: string;
	name: string;
	status: string;
	progress: number;
	createdAt: string | null;
};

export function AdminPerformanceToolsShell({ recentJobs }: { recentJobs: RecentOperatorJobRow[] }) {
	const router = useRouter();
	const [grade, setGrade] = useState("9");

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-muted-foreground">
					Bulk tracker re-init and recent operator jobs. Saved grade presets apply to the panel below.{" "}
					<Link className="text-primary underline" href="/admin/performance/tracker">
						Open tracker
					</Link>{" "}
					to inspect a single student matrix.
				</p>
				<AdminPerformanceGradePresets grade={grade} onApplyGrade={setGrade} />
			</div>
			<AdminBulkReinitPanel
				grade={grade}
				onGradeChange={setGrade}
				onJobFinished={() => router.refresh()}
			/>
			<section className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-semibold">Recent bulk jobs</h2>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
							Refresh
						</Button>
						<Link className="text-sm text-primary underline" href="/admin/system/jobs">
							All operator jobs
						</Link>
					</div>
				</div>
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[640px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th className="px-3 py-2 font-medium">Created</th>
								<th className="px-3 py-2 font-medium">Queue</th>
								<th className="px-3 py-2 font-medium">Name</th>
								<th className="px-3 py-2 font-medium">Status</th>
								<th className="px-3 py-2 font-medium">Progress</th>
							</tr>
						</thead>
						<tbody>
							{recentJobs.length === 0 ?
								<tr>
									<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
										No jobs yet. Start bulk re-init above.
									</td>
								</tr>
							:	recentJobs.map((j) => (
									<tr key={j.id} className="border-b border-border/80">
										<td className="px-3 py-2 text-muted-foreground">
											{j.createdAt ? formatDateTimeMediumShortInAppTimeZone(j.createdAt) : "—"}
										</td>
										<td className="px-3 py-2 font-mono text-xs">{j.queue}</td>
										<td className="px-3 py-2">{j.name}</td>
										<td className="px-3 py-2">{j.status}</td>
										<td className="px-3 py-2 tabular-nums">{j.progress}%</td>
									</tr>
								))
							}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
