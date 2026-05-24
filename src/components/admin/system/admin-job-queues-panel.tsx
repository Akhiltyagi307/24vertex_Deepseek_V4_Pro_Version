"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDestructive } from "@/components/admin/confirm-destructive";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { Button } from "@/components/ui/button";

export type AdminJobQueueRow = {
	name: string;
	paused: boolean;
};

export function AdminJobQueuesPanel({ queues }: { queues: AdminJobQueueRow[] }) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	async function setPaused(name: string, pause: boolean) {
		setBusy(name);
		setError(null);
		setMessage(null);
		try {
			const res = await fetch(
				`/api/admin/jobs/queues/${encodeURIComponent(name)}/${pause ? "pause" : "resume"}`,
				{ method: "POST", credentials: "include" },
			);
			if (!res.ok) {
				setError(await adminHttpErrorMessage(res, res.statusText));
				return;
			}
			setMessage(pause ? `Queue "${name}" paused.` : `Queue "${name}" resumed.`);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="space-y-3">
			{message ?
				<p className="text-sm text-muted-foreground" role="status" aria-live="polite">
					{message}
				</p>
			:	null}
			{error ?
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			:	null}
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[480px] text-left text-sm">
					<caption className="sr-only">Operator job queues with pause and resume actions</caption>
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th scope="col" className="px-3 py-2 font-medium">
								Queue
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Status
							</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{queues.length === 0 ?
							<tr>
								<td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
									No operator queues configured.
								</td>
							</tr>
						:	queues.map((q) => (
								<tr key={q.name} className="border-b border-border/80">
									<th scope="row" className="px-3 py-2 text-left font-mono text-xs font-normal">
										{q.name}
									</th>
									<td className="px-3 py-2">
										<span
											className={
												q.paused ?
													"rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
												:	"rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
											}
										>
											{q.paused ? "Paused" : "Active"}
										</span>
									</td>
									<td className="px-3 py-2 text-right">
										{q.paused ?
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={busy !== null}
												aria-label={`Resume queue ${q.name}`}
												onClick={() => void setPaused(q.name, false)}
											>
												{busy === q.name ? "Working…" : "Resume"}
											</Button>
										:	busy !== null ?
											<Button type="button" variant="destructive" size="sm" disabled>
												Pause
											</Button>
										:	<ConfirmDestructive
												title={`Pause queue ${q.name}?`}
												description="Queued operator jobs in this queue will not drain until you resume."
												confirmLabel="Pause"
												onConfirm={() => setPaused(q.name, true)}
											>
												Pause
											</ConfirmDestructive>
										}
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
