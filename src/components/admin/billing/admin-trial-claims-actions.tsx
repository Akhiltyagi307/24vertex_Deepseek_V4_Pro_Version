"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminTrialClaimsActions() {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [identity, setIdentity] = useState("");
	const [reason, setReason] = useState("");

	const postJson = async (url: string, body: object) => {
		const res = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const j = (await res.json().catch(() => ({}))) as { error?: string };
		if (!res.ok) throw new Error(j.error ?? res.statusText);
	};

	return (
		<div className="grid max-w-2xl gap-6 rounded-lg border border-border p-4 md:grid-cols-2">
			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Release trial claim</h3>
				<p className="text-xs text-muted-foreground">Clears the one-trial lock so another profile can claim.</p>
				<Input placeholder="identity_key" className="h-9 font-mono text-xs" value={identity} onChange={(e) => setIdentity(e.target.value)} />
				<Input placeholder="reason (optional)" className="h-9" value={reason} onChange={(e) => setReason(e.target.value)} />
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={busy !== null || !identity.trim()}
					onClick={async () => {
						setBusy("rel");
						try {
							await postJson("/api/admin/trial-claims/release", {
								identity_key: identity.trim(),
								reason: reason.trim() || undefined,
							});
							setIdentity("");
							setReason("");
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					{busy === "rel" ? "…" : "Release"}
				</Button>
			</div>
			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Block identity</h3>
				<p className="text-xs text-muted-foreground">Adds to blocklist (enforcement when wired into signup).</p>
				<Input
					placeholder="identity_key"
					className="h-9 font-mono text-xs"
					value={identity}
					onChange={(e) => setIdentity(e.target.value)}
				/>
				<Input placeholder="reason (optional)" className="h-9" value={reason} onChange={(e) => setReason(e.target.value)} />
				<Button
					type="button"
					size="sm"
					variant="destructive"
					disabled={busy !== null || !identity.trim()}
					onClick={async () => {
						if (!confirm("Add this identity to the blocklist?")) return;
						setBusy("blk");
						try {
							await postJson("/api/admin/trial-claims/block", {
								identity_key: identity.trim(),
								reason: reason.trim() || undefined,
							});
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					{busy === "blk" ? "…" : "Block"}
				</Button>
			</div>
		</div>
	);
}
