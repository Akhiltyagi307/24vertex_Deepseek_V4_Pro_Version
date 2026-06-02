"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GrantRow = {
	id: string;
	grant_type: string;
	quantity: number;
	consumed: number;
	expires_at: string | null;
	note: string | null;
	created_at: string;
};

type Props = { subscriptionId: string };

export function AdminQuotaGrantsPanel({ subscriptionId }: Props) {
	const router = useRouter();
	const [rows, setRows] = useState<GrantRow[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [quantity, setQuantity] = useState("5");
	const [expiresAt, setExpiresAt] = useState("");
	const [note, setNote] = useState("");

	// Out-of-order guard: only the most recent load may apply its rows, so a slow
	// response (e.g. after a subscriptionId change or a post-mutation refresh)
	// can't overwrite newer data.
	const reqIdRef = useRef(0);
	const load = useCallback(async () => {
		const reqId = ++reqIdRef.current;
		const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/grants`, { credentials: "include" });
		const j = (await res.json()) as { data?: GrantRow[] };
		if (!res.ok) throw new Error("Failed to load grants");
		if (reqId !== reqIdRef.current) return;
		setRows(j.data ?? []);
	}, [subscriptionId]);

	useEffect(() => {
		let ignore = false;
		void load().catch(() => {
			if (!ignore) setRows([]);
		});
		return () => {
			ignore = true;
		};
	}, [load]);

	if (rows === null) {
		return <p className="text-sm text-muted-foreground">Loading quota grants…</p>;
	}

	return (
		<div className="space-y-4 rounded-lg border border-border p-4">
			<h3 className="text-sm font-semibold">Quota grants (tests)</h3>
			<p className="text-sm text-muted-foreground">Consumed before subscription period quota. Type: tests only in this build.</p>

			<form
				className="flex flex-wrap items-end gap-2"
				onSubmit={async (e) => {
					e.preventDefault();
					const q = Number(quantity);
					if (!Number.isFinite(q) || q <= 0) return;
					setBusy("add");
					try {
						const body: Record<string, unknown> = { grant_type: "tests", quantity: q, note: note.trim() || null };
						if (expiresAt.trim()) body.expires_at = new Date(expiresAt).toISOString();
						const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/grants`, {
							method: "POST",
							credentials: "include",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(body),
						});
						const j = (await res.json().catch(() => ({}))) as { error?: string };
						if (!res.ok) throw new Error(j.error ?? res.statusText);
						setNote("");
						await load();
						router.refresh();
					} catch (err) {
						alert(err instanceof Error ? err.message : "Failed");
					} finally {
						setBusy(null);
					}
				}}
			>
				<div className="flex flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="qg-q">
						Quantity
					</label>
					<Input id="qg-q" className="h-9 w-24" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="qg-exp">
						Expires (local), optional
					</label>
					<Input id="qg-exp" className="h-9 w-56" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
				</div>
				<div className="min-w-[12rem] flex-1 flex-col gap-1">
					<label className="text-xs font-medium text-muted-foreground" htmlFor="qg-note">
						Note
					</label>
					<Input id="qg-note" className="h-9" value={note} onChange={(e) => setNote(e.target.value)} />
				</div>
				<Button type="submit" size="sm" disabled={busy !== null}>
					Add grant
				</Button>
			</form>

			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<th className="px-2 py-2">Type</th>
							<th className="px-2 py-2">Qty</th>
							<th className="px-2 py-2">Used</th>
							<th className="px-2 py-2">Expires</th>
							<th className="px-2 py-2" />
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id} className="border-b border-border/80">
								<td className="px-2 py-2 font-mono text-xs">{r.grant_type}</td>
								<td className="px-2 py-2 tabular-nums">{r.quantity}</td>
								<td className="px-2 py-2 tabular-nums">{r.consumed}</td>
								<td className="px-2 py-2 text-muted-foreground">{r.expires_at ? r.expires_at.slice(0, 16) : "—"}</td>
								<td className="px-2 py-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-destructive"
										disabled={busy !== null || r.consumed > 0}
										title={r.consumed > 0 ? "Cannot delete partially used grant" : "Delete unused grant"}
										onClick={async () => {
											if (!confirm("Delete this grant row?")) return;
											setBusy(`del-${r.id}`);
											try {
												const res = await fetch(`/api/admin/grants/${r.id}`, {
													method: "DELETE",
													credentials: "include",
												});
												const j = (await res.json().catch(() => ({}))) as { error?: string };
												if (!res.ok) throw new Error(j.error ?? res.statusText);
												await load();
												router.refresh();
											} catch (err) {
												alert(err instanceof Error ? err.message : "Failed");
											} finally {
												setBusy(null);
											}
										}}
									>
										Delete
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No grants.</p> : null}
			</div>
		</div>
	);
}
