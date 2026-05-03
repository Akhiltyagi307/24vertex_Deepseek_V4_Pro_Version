"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
	eventId: string;
	initialProcessedAt: string | null;
	initialResolvedAt: string | null;
};

export function AdminBillingEventActions({ eventId, initialProcessedAt, initialResolvedAt }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);

	const post = async (path: string) => {
		const res = await fetch(path, { method: "POST", credentials: "include" });
		const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
		if (!res.ok) throw new Error(j.detail ?? j.error ?? res.statusText);
	};

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={busy !== null}
				onClick={async () => {
					if (
						!confirm(
							"Replay runs the stored webhook payload through the live processor. Side effects (emails, subscription updates) may occur. Continue?",
						)
					) {
						return;
					}
					setBusy("replay");
					try {
						await post(`/api/admin/billing/events/${eventId}/replay`);
						router.refresh();
					} catch (e) {
						alert(e instanceof Error ? e.message : "Failed");
					} finally {
						setBusy(null);
					}
				}}
			>
				{busy === "replay" ? "Replaying…" : "Replay processor"}
			</Button>
			<Button
				type="button"
				variant="secondary"
				size="sm"
				disabled={busy !== null || Boolean(initialResolvedAt)}
				title={initialResolvedAt ? "Already resolved" : undefined}
				onClick={async () => {
					if (!confirm("Mark this event resolved (operator triage)?")) return;
					setBusy("resolve");
					try {
						await post(`/api/admin/billing/events/${eventId}/resolve`);
						router.refresh();
					} catch (e) {
						alert(e instanceof Error ? e.message : "Failed");
					} finally {
						setBusy(null);
					}
				}}
			>
				Mark resolved
			</Button>
			<p className="w-full text-xs text-muted-foreground">
				Processed: {initialProcessedAt ?? "—"} · Resolved: {initialResolvedAt ?? "—"}
			</p>
		</div>
	);
}
