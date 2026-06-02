"use client";

import { useEffect, useState } from "react";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { Button } from "@/components/ui/button";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export function AdminEmailSuppressionsClient() {
	const [raw, setRaw] = useState<string>("Loading…");
	const [email, setEmail] = useState("");
	const [reason, setReason] = useState("");
	const [msg, setMsg] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const controller = new AbortController();
		void (async () => {
			try {
				const res = await fetch("/api/admin/email-log/suppressions", { signal: controller.signal });
				const j: unknown = await res.json();
				if (cancelled) return;
				setRaw(JSON.stringify(j, null, 2));
			} catch {
				// Aborted on unmount, or a network failure — leave the "Loading…" placeholder.
			}
		})();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, []);

	async function remove() {
		setMsg(null);
		const res = await fetch("/api/admin/email-log/suppressions/remove", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, reason }),
		});
		const j = await res.json();
		if (!res.ok) setMsg(j.error ?? "Failed");
		else setMsg("Removed (verify in Resend).");
	}

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<h1 className="text-2xl font-semibold tracking-tight">Suppressions</h1>
			<p className="text-sm text-muted-foreground">Passthrough list from Resend bounce suppression API.</p>
			<div className="flex flex-wrap justify-end gap-2">
				<AdminSavedViews listId={ADMIN_LIST_ID.communicationsSuppressions} />
				<AdminExportButton
					filenameBase="email-suppressions"
					headers={["payload"]}
					rows={raw !== "Loading…" ? [{ payload: raw }] : []}
					disabled={raw === "Loading…"}
				/>
			</div>
			<pre className="max-h-[320px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{raw}</pre>
			<div className="space-y-2 rounded-md border border-border p-4">
				<h2 className="text-sm font-medium">Remove suppression</h2>
				<input
					className="w-full rounded-md border border-border px-3 py-2 text-sm"
					placeholder="email@domain.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
				<input
					className="w-full rounded-md border border-border px-3 py-2 text-sm"
					placeholder="Reason (required)"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
				/>
				{msg ?
					<p className="text-sm">{msg}</p>
				:	null}
				<Button type="button" disabled={!email || !reason} onClick={() => void remove()}>
					Remove
				</Button>
			</div>
		</div>
	);
}
