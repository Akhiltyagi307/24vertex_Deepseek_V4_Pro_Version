"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type RetentionPolicyRowData = {
	entity: string;
	ttlDays: number;
	enabled: boolean;
	lastPurge: Date | null;
};

export function RetentionPolicyRow({ policy }: { policy: RetentionPolicyRowData }) {
	const router = useRouter();
	const [ttl, setTtl] = useState(String(policy.ttlDays));
	const [enabled, setEnabled] = useState(policy.enabled);
	const [msg, setMsg] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function save() {
		setBusy(true);
		setMsg(null);
		try {
			const res = await fetch(`/api/admin/compliance/retention/${encodeURIComponent(policy.entity)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ttl_days: Number.parseInt(ttl, 10),
					enabled,
				}),
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok) {
				setMsg(j.error ? JSON.stringify(j.error) : res.statusText);
				return;
			}
			router.refresh();
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	async function dryRun() {
		setBusy(true);
		setMsg(null);
		try {
			const res = await fetch(`/api/admin/compliance/retention/${encodeURIComponent(policy.entity)}/run-now`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ dry_run: true }),
			});
			const j = await res.json().catch(() => ({}));
			setMsg(JSON.stringify(j, null, 2));
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm">
			<span className="min-w-[140px] font-mono text-xs font-medium">{policy.entity}</span>
			<label className="flex items-center gap-2">
				<input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
				enabled
			</label>
			<label className="flex items-center gap-2">
				<span className="text-muted-foreground">TTL days</span>
				<input
					className="w-24 rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
					value={ttl}
					onChange={(e) => setTtl(e.target.value)}
				/>
			</label>
			<span className="text-xs text-muted-foreground">
				Last purge: {policy.lastPurge?.toISOString?.() ?? "—"}
			</span>
			<div className="ml-auto flex flex-wrap gap-2">
				<Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void save()}>
					Save
				</Button>
				<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void dryRun()}>
					Dry run
				</Button>
			</div>
			{msg ? <pre className="w-full max-h-40 overflow-auto text-xs">{msg}</pre> : null}
		</div>
	);
}
