"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { DestructiveConfirm } from "@/components/admin/destructive-confirm";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";

type BulkReinitJobState = {
	status: "queued" | "running" | "done" | "failed";
	processed: number;
	total: number;
	grade: number;
	error?: string;
};

type Props = {
	grade?: string;
	onGradeChange?: (g: string) => void;
	onJobFinished?: () => void;
};

function parsePollState(raw: unknown): BulkReinitJobState | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const status = o.status;
	if (status !== "queued" && status !== "running" && status !== "done" && status !== "failed") return null;
	return {
		status,
		processed: typeof o.processed === "number" ? o.processed : 0,
		total: typeof o.total === "number" ? o.total : 0,
		grade: typeof o.grade === "number" ? o.grade : 0,
		...(typeof o.error === "string" ? { error: o.error } : {}),
	};
}

function jobIsActive(state: BulkReinitJobState | null): boolean {
	return state?.status === "queued" || state?.status === "running";
}

export function AdminBulkReinitPanel({ grade: gradeProp, onGradeChange, onJobFinished }: Props = {}) {
	const router = useRouter();
	const [gradeInternal, setGradeInternal] = React.useState("9");
	const grade = gradeProp ?? gradeInternal;
	const setGrade = onGradeChange ?? setGradeInternal;
	const [confirmOpen, setConfirmOpen] = React.useState(false);
	const [jobId, setJobId] = React.useState<string | null>(null);
	const [status, setStatus] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [poll, setPoll] = React.useState<BulkReinitJobState | null>(null);
	const [detailsOpen, setDetailsOpen] = React.useState(false);
	const finishedNotified = React.useRef(false);

	const start = async () => {
		setStatus(null);
		setError(null);
		setPoll(null);
		finishedNotified.current = false;
		const g = Number.parseInt(grade, 10);
		if (!Number.isFinite(g) || g < 1 || g > 12) {
			setError("Grade must be between 1 and 12.");
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
			setError(await adminHttpErrorMessage(res, j.error ?? "Failed to start job"));
			return;
		}
		setJobId(j.job_id ?? null);
		setStatus("Job queued. Progress updates below.");
	};

	React.useEffect(() => {
		if (!jobId) return;
		const id = window.setInterval(() => {
			void (async () => {
				try {
					const res = await fetch(`/api/admin/performance/jobs/bulk-reinit/${jobId}`, {
						credentials: "include",
					});
					if (!res.ok) return;
					const j = (await res.json()) as { data?: unknown };
					const state = parsePollState(j.data ?? j);
					if (!state) return;
					setPoll(state);
					if ((state.status === "done" || state.status === "failed") && !finishedNotified.current) {
						finishedNotified.current = true;
						onJobFinished?.();
						router.refresh();
					}
				} catch {
					// transient poll failure — next tick retries
				}
			})();
		}, 2000);
		return () => window.clearInterval(id);
	}, [jobId, onJobFinished, router]);

	const active = jobIsActive(poll);
	const progressPct =
		poll && poll.total > 0 ? Math.min(100, Math.round((poll.processed / poll.total) * 100)) : poll?.status === "done" ? 100 : 0;

	const confirmPhrase = `grade-${grade.trim()}`;

	return (
		<div className="space-y-3 rounded-md border border-border p-4">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">Bulk tracker re-init by grade</h2>
				<p className="text-xs text-muted-foreground">
					Runs{" "}
					<code className="rounded bg-muted px-1">sync_student_performance_tracker_for_student</code> for
					every active student in the grade. Resets curriculum once per student, then syncs. Progress is stored
					in Postgres <code className="rounded bg-muted px-1">admin_runtime_kv</code>.
				</p>
			</div>
			<div className="flex flex-wrap items-end gap-2">
				<div className="space-y-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="bulk-reinit-grade">
						Grade
					</label>
					<Input
						id="bulk-reinit-grade"
						value={grade}
						onChange={(e) => setGrade(e.target.value)}
						className="w-24"
						disabled={active}
						inputMode="numeric"
					/>
				</div>
				<Button type="button" variant="destructive" disabled={active} onClick={() => setConfirmOpen(true)}>
					Start bulk re-init…
				</Button>
			</div>
			{status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			{jobId ? <p className="font-mono text-xs text-muted-foreground">job_id: {jobId}</p> : null}
			{poll ?
				<div className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
					<p className="text-sm font-medium capitalize">
						Status: {poll.status}
						{poll.status === "failed" && poll.error ?
							<span className="ml-1 font-normal text-destructive">({poll.error})</span>
						:	null}
					</p>
					<Progress value={progressPct} className="w-full flex-col gap-2">
						<div className="flex w-full items-center gap-2">
							<ProgressLabel className="text-xs text-muted-foreground">Students processed</ProgressLabel>
							<ProgressValue>
								{() => `${poll.processed} / ${poll.total || "?"}`}
							</ProgressValue>
						</div>
					</Progress>
					<Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
						<CollapsibleTrigger
							type="button"
							className="text-xs font-medium text-primary underline-offset-2 hover:underline"
						>
							{detailsOpen ? "Hide" : "Show"} raw job payload
						</CollapsibleTrigger>
						<CollapsibleContent>
							<pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/40 p-2 text-xs">
								{JSON.stringify(poll, null, 2)}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				</div>
			:	null}

			<DestructiveConfirm
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title={`Re-init trackers for grade ${grade.trim()}`}
				description={
					<>
						This runs a full tracker sync for every student in grade {grade.trim()}. It is heavy and
						audited. Type <span className="font-mono">{confirmPhrase}</span> to confirm.
					</>
				}
				confirmText={confirmPhrase}
				onConfirm={async () => {
					await start();
				}}
				submitLabel="Start job"
			/>
		</div>
	);
}
