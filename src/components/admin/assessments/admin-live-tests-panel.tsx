"use client";

import Link from "next/link";
import * as React from "react";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { Button } from "@/components/ui/button";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LiveRow = {
	id: string;
	student_id: string;
	student_name: string | null;
	subject_name: string | null;
	status: string | null;
	anomaly_flags: string[];
	updated_at: string | null;
};

export function AdminLiveTestsPanel() {
	const [rows, setRows] = React.useState<LiveRow[]>([]);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		try {
			const res = await fetch("/api/admin/tests/live", { credentials: "include" });
			const j = (await res.json()) as { data?: LiveRow[]; error?: string };
			if (!res.ok) throw new Error(j.error ?? res.statusText);
			setRows(j.data ?? []);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	// Replace the previous 2.5s busy-poll with a Supabase realtime subscription
	// on the `tests` table plus a 30s heartbeat. Any INSERT/UPDATE re-fetches
	// the projection (the "last 5 minutes" filter lives server-side, so we can't
	// merge the row payload locally — re-fetch is the only correct option).
	React.useEffect(() => {
		void load();
		const supabase = createBrowserSupabase();
		let cancelled = false;
		const channel = supabase
			.channel("admin-live-tests")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "tests" },
				() => {
					if (!cancelled) void load();
				},
			)
			.subscribe();
		// Heartbeat: catches missed events (network blip, channel churn, slow
		// status fall-off the 5-min window without an UPDATE/INSERT).
		const heartbeat = window.setInterval(() => {
			if (!cancelled) void load();
		}, 30_000);
		return () => {
			cancelled = true;
			window.clearInterval(heartbeat);
			void supabase.removeChannel(channel);
		};
	}, [load]);

	const exportRows: Record<string, unknown>[] = rows.map((r) => ({
		id: r.id,
		student_id: r.student_id,
		student_name: r.student_name ?? "",
		subject_name: r.subject_name ?? "",
		status: r.status ?? "",
		anomaly_flags: r.anomaly_flags.join(";"),
		updated_at: r.updated_at ?? "",
	}));

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Button type="button" size="sm" variant="outline" onClick={() => void load()}>
						Refresh now
					</Button>
					<span className="text-xs text-muted-foreground">Live (realtime + 30s heartbeat)</span>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<AdminSavedViews listId={ADMIN_LIST_ID.assessmentsLive} />
					<AdminExportButton
						filenameBase="assessments-live"
						headers={["id", "student_id", "student_name", "subject_name", "status", "anomaly_flags", "updated_at"]}
						rows={exportRows}
						disabled={rows.length === 0}
					/>
				</div>
			</div>
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[720px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-2 py-1.5">Student</th>
							<th className="px-2 py-1.5">Subject</th>
							<th className="px-2 py-1.5">Flags</th>
							<th className="px-2 py-1.5">Updated</th>
							<th className="px-2 py-1.5">Open</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ?
							<tr>
								<td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
									No in-progress tests (last 5 minutes)
								</td>
							</tr>
						:	rows.map((r) => (
								<tr key={r.id} className="border-b border-border/70">
									<td className="px-2 py-1.5">{r.student_name ?? r.student_id.slice(0, 8)}</td>
									<td className="px-2 py-1.5">{r.subject_name ?? "—"}</td>
									<td className="px-2 py-1.5">
										<div className="flex flex-wrap gap-1">
											{r.anomaly_flags.map((f) => (
												<span key={f} className={cn("rounded bg-muted px-1 py-0.5 text-xs")}>
													{f}
												</span>
											))}
										</div>
									</td>
									<td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
										{r.updated_at ? formatDateTimeMediumShortInAppTimeZone(r.updated_at) : "—"}
									</td>
									<td className="px-2 py-1.5">
										<Link className="text-primary underline-offset-2 hover:underline" href={`/admin/assessments/tests/${r.id}`}>
											Detail
										</Link>
									</td>
								</tr>
							))
						}
					</tbody>
				</table>
			</div>
		</div>
	);
}
