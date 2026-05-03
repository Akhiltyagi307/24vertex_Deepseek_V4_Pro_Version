"use client";

import { useCallback, useEffect, useState } from "react";

import { ConfirmDestructive } from "@/components/admin/confirm-destructive";
import { Button } from "@/components/ui/button";

type SessionRow = {
	id: string;
	jwt_id: string;
	ip_address: string | null;
	user_agent: string | null;
	totp_used: boolean;
	created_at: string | null;
	last_seen_at: string | null;
	is_current: boolean;
};

export function AdminActiveSessionsClient() {
	const [rows, setRows] = useState<SessionRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/admin/sessions", { credentials: "include" });
			const j = (await res.json()) as { data?: SessionRow[]; error?: string };
			if (!res.ok) {
				setError(j.error ?? res.statusText);
				setRows([]);
				return;
			}
			setRows(j.data ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function revokeOne(id: string) {
		const res = await fetch(`/api/admin/sessions/${id}/revoke`, {
			method: "POST",
			credentials: "include",
		});
		if (!res.ok) {
			const j = (await res.json()) as { error?: string };
			setError(j.error ?? res.statusText);
			return;
		}
		await load();
	}

	async function revokeOthers() {
		const res = await fetch("/api/admin/sessions/revoke-others", {
			method: "POST",
			credentials: "include",
		});
		if (!res.ok) {
			const j = (await res.json()) as { error?: string };
			setError(j.error ?? res.statusText);
			return;
		}
		await load();
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
					{loading ? "Refreshing…" : "Refresh"}
				</Button>
				<ConfirmDestructive
					title="Kill all other sessions?"
					description="Every other admin browser tab will be signed out on the next request (within a few seconds)."
					confirmLabel="Kill others"
					onConfirm={revokeOthers}
				>
					Kill all other sessions
				</ConfirmDestructive>
			</div>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Current</th>
							<th className="px-3 py-2 font-medium">Last seen</th>
							<th className="px-3 py-2 font-medium">IP</th>
							<th className="max-w-[200px] px-3 py-2 font-medium">User agent</th>
							<th className="px-3 py-2 font-medium">TOTP</th>
							<th className="px-3 py-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 && !loading ?
							<tr>
								<td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
									No active sessions.
								</td>
							</tr>
						:	null}
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-3 py-2">{r.is_current ? "Yes" : "—"}</td>
								<td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
									{r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : "—"}
								</td>
								<td className="px-3 py-2 font-mono text-xs">{r.ip_address ?? "—"}</td>
								<td className="max-w-[220px] truncate px-3 py-2 text-xs" title={r.user_agent ?? ""}>
									{r.user_agent ?? "—"}
								</td>
								<td className="px-3 py-2">{r.totp_used ? "Yes" : "—"}</td>
								<td className="px-3 py-2 text-right">
									{r.is_current ?
										<span className="text-xs text-muted-foreground">—</span>
									:	<ConfirmDestructive
											title="Revoke this session?"
											description="That browser will be signed out on the next admin request."
											confirmLabel="Kill"
											onConfirm={() => revokeOne(r.id)}
										>
											Kill
										</ConfirmDestructive>
									}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
