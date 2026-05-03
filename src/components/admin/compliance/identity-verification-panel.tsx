"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function IdentityVerificationPanel({
	requestId,
	initialVerified,
}: {
	requestId: string;
	initialVerified: boolean;
}) {
	const router = useRouter();
	const [evidenceUrl, setEvidenceUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	if (initialVerified) {
		return <p className="text-sm text-muted-foreground">Identity marked verified.</p>;
	}

	async function verify() {
		setBusy(true);
		setErr(null);
		try {
			const res = await fetch(`/api/admin/compliance/requests/${requestId}/verify-identity`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ evidence_url: evidenceUrl.trim() || undefined }),
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok) {
				setErr(j.error ? JSON.stringify(j.error) : res.statusText);
				return;
			}
			router.refresh();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Request failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
			<h3 className="text-sm font-semibold">Identity verification</h3>
			<p className="text-xs text-muted-foreground">
				Confirm the requester before export or erasure. Optionally record an evidence URL (signed PDF, ticket id).
			</p>
			<input
				className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
				placeholder="Evidence URL (optional)"
				value={evidenceUrl}
				onChange={(e) => setEvidenceUrl(e.target.value)}
			/>
			<Button type="button" size="sm" disabled={busy} onClick={() => void verify()}>
				{busy ? "Saving…" : "Mark identity verified"}
			</Button>
			{err ? <p className="text-xs text-destructive">{err}</p> : null}
		</div>
	);
}
