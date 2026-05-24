"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionFailureRetryButton } from "@/components/admin/billing/action-failure-retry-button";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function ActionFailureDetailActions({
	failureId,
	resolved,
}: {
	failureId: string;
	resolved: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function markResolved() {
		if (!note.trim()) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(`/api/admin/billing/action-failures/${failureId}/resolve`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resolution_note: note.trim() }),
			});
			const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
			if (!res.ok) {
				setError(j.detail ?? j.error ?? res.statusText);
				return;
			}
			setOpen(false);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	if (resolved) {
		return <p className="text-sm text-muted-foreground">This failure is resolved.</p>;
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<ActionFailureRetryButton failureId={failureId} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger render={<Button type="button" variant="outline" size="sm" aria-label="Mark failure resolved" />}>
					Mark resolved
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mark failure resolved</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="af-resolve-note">Resolution note</Label>
						<textarea
							id="af-resolve-note"
							className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							maxLength={2000}
							rows={3}
						/>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="button" disabled={busy || !note.trim()} onClick={() => void markResolved()}>
							{busy ? "Saving…" : "Confirm"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
