"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ConsentRerequestForm() {
	const [studentId, setStudentId] = useState("");
	const [msg, setMsg] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function send() {
		setBusy(true);
		setMsg(null);
		try {
			const res = await fetch(`/api/admin/compliance/consents/${studentId.trim()}/request`, { method: "POST" });
			const j = await res.json().catch(() => ({}));
			if (!res.ok) {
				setMsg(j.error ?? res.statusText);
				return;
			}
			setMsg("Sent.");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/10 p-4">
			<div className="min-w-[240px] flex-1">
				<label className="text-xs font-medium text-muted-foreground">Student UUID</label>
				<input
					className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
					value={studentId}
					onChange={(e) => setStudentId(e.target.value)}
					placeholder="00000000-0000-0000-0000-000000000000"
				/>
			</div>
			<Button type="button" size="sm" disabled={busy || !studentId.trim()} onClick={() => void send()}>
				{busy ? "Sending…" : "Re-request consent email"}
			</Button>
			{msg ? <p className="w-full text-xs text-muted-foreground">{msg}</p> : null}
		</div>
	);
}
