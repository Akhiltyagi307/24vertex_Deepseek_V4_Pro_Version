"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminBulkReinitPanel() {
	const [grade, setGrade] = React.useState("9");
	const [jobId, setJobId] = React.useState<string | null>(null);
	const [status, setStatus] = React.useState<string | null>(null);
	const [poll, setPoll] = React.useState<unknown>(null);

	const start = async () => {
		setStatus(null);
		setPoll(null);
		const g = Number.parseInt(grade, 10);
		if (!Number.isFinite(g) || g < 1 || g > 12) {
			setStatus("Invalid grade");
			return;
		}
		const res = await fetch("/api/admin/performance/jobs/bulk-reinit", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ grade: g }),
		});
		const j = (await res.json()) as { job_id?: string; error?: string };
		if (!res.ok) {
			setStatus(j.error ?? "Failed");
			return;
		}
		setJobId(j.job_id ?? null);
		setStatus("Started");
	};

	React.useEffect(() => {
		if (!jobId) return;
		const id = window.setInterval(async () => {
			const res = await fetch(`/api/admin/performance/jobs/bulk-reinit/${jobId}`, { credentials: "include" });
			const j = await res.json();
			setPoll(j.data ?? j);
		}, 2000);
		return () => window.clearInterval(id);
	}, [jobId]);

	return (
		<div className="space-y-3 rounded-md border border-border p-4">
			<h2 className="text-lg font-semibold">Bulk tracker re-init by grade</h2>
			<p className="text-xs text-muted-foreground">
				Runs <code className="rounded bg-muted px-1">sync_student_performance_tracker_for_student</code> for every student in the grade.
				Progress is stored in Postgres <code className="rounded bg-muted px-1">admin_runtime_kv</code> (not Redis).
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<div className="space-y-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="grade">
						Grade
					</label>
					<Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-24" />
				</div>
				<Button type="button" onClick={() => void start()}>
					Start job
				</Button>
			</div>
			{status ? <p className="text-sm">{status}</p> : null}
			{jobId ? <p className="font-mono text-xs text-muted-foreground">job_id: {jobId}</p> : null}
			{poll ?
				<pre className="max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-xs">{JSON.stringify(poll, null, 2)}</pre>
			:	null}
		</div>
	);
}
