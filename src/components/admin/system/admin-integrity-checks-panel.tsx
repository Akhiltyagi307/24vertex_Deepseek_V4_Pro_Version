"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";

export type IntegrityCheckSummary = {
	name: string;
	lastRows: number | null;
	lastRanAt: string | null;
};

function integrityStatusChip(lastRows: number | null, lastRanAt: string | null) {
	if (lastRanAt == null) {
		return (
			<span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Never run</span>
		);
	}
	if (lastRows === 0) {
		return (
			<span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
				Clean
			</span>
		);
	}
	return (
		<span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
			{lastRows ?? 0} issue{(lastRows ?? 0) === 1 ? "" : "s"}
		</span>
	);
}

export function AdminIntegrityChecksPanel({ checks }: { checks: IntegrityCheckSummary[] }) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function runCheck(name: string) {
		setBusy(name);
		setMessage(null);
		setError(null);
		try {
			const res = await fetch(`/api/admin/system/integrity/checks/${encodeURIComponent(name)}/run`, {
				method: "POST",
				credentials: "include",
			});
			const j = (await res.json().catch(() => ({}))) as {
				data?: { rowsFound?: number; rows_found?: number };
				error?: string;
				detail?: string;
			};
			if (!res.ok) {
				setError(await adminHttpErrorMessage(res, res.statusText));
				return;
			}
			const rows = j.data?.rowsFound ?? j.data?.rows_found;
			setMessage(
				rows != null ? `Check "${name}" finished. Rows found: ${rows}.` : `Check "${name}" finished.`,
			);
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
				<table className="w-full min-w-[720px] text-left text-sm">
					<caption className="sr-only">Integrity checks with run actions</caption>
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th scope="col" className="px-3 py-2 font-medium">
								Check
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Status
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Last rows
							</th>
							<th scope="col" className="px-3 py-2 font-medium">
								Last run
							</th>
							<th scope="col" className="px-3 py-2 text-right font-medium">
								Actions
							</th>
						</tr>
					</thead>
					<tbody>
						{checks.length === 0 ?
							<tr>
								<td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
									No integrity checks configured.
								</td>
							</tr>
						:	checks.map((c) => (
								<tr key={c.name} className="border-b border-border/80">
									<th scope="row" className="px-3 py-2 text-left font-mono text-xs font-normal">
										{c.name}
									</th>
									<td className="px-3 py-2">{integrityStatusChip(c.lastRows, c.lastRanAt)}</td>
									<td className="px-3 py-2 tabular-nums">{c.lastRanAt != null ? (c.lastRows ?? "—") : "—"}</td>
									<td className="px-3 py-2 text-muted-foreground">
										{c.lastRanAt ? formatDateTimeMediumShortInAppTimeZone(c.lastRanAt) : "—"}
									</td>
									<td className="px-3 py-2 text-right">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={busy !== null}
											aria-label={`Run integrity check ${c.name}`}
											onClick={() => void runCheck(c.name)}
										>
											{busy === c.name ? "Running…" : "Run"}
										</Button>
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
