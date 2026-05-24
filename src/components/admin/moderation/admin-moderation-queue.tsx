"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type ModerationFlagRow = {
	id: string;
	entityType: string;
	entityId: string;
	source: string;
	severity: string;
	status: string;
	reason: string | null;
	createdAt: string;
};

type ResolveStatus = "reviewing" | "upheld" | "dismissed";

function entityHref(entityType: string, entityId: string): string | null {
	if (entityType === "test") return `/admin/assessments/tests/${entityId}`;
	if (entityType === "profile" || entityType === "user") return `/admin/users/${entityId}`;
	return null;
}

export function AdminModerationQueue({ flags }: { flags: ModerationFlagRow[] }) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<{ id: string; status: ResolveStatus } | null>(null);
	const [notes, setNotes] = useState("");

	async function resolve(flagId: string, status: ResolveStatus, resolutionNotes: string) {
		setBusy(flagId);
		setError(null);
		try {
			const res = await fetch(`/api/admin/moderation/flags/${flagId}/resolve`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status,
					resolution: status,
					resolution_notes: resolutionNotes.trim() || undefined,
				}),
			});
			await res.json().catch(() => null);
			if (!res.ok) {
				setError(await adminHttpErrorMessage(res, res.statusText));
				return;
			}
			setDialog(null);
			setNotes("");
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="space-y-3">
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[900px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-3 py-2 font-medium">Created</th>
							<th className="px-3 py-2 font-medium">Entity</th>
							<th className="px-3 py-2 font-medium">Source</th>
							<th className="px-3 py-2 font-medium">Severity</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Reason</th>
							<th className="px-3 py-2 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{flags.length === 0 ?
							<tr>
								<td colSpan={7} className="px-3 py-6 text-muted-foreground">
									No flags yet.
								</td>
							</tr>
						:	flags.map((r) => {
								const href = entityHref(r.entityType, r.entityId);
								const open = r.status === "open" || r.status === "reviewing";
								return (
									<tr key={r.id} className="border-b border-border/80">
										<td className="px-3 py-2 text-muted-foreground">{r.createdAt}</td>
										<td className="px-3 py-2 font-mono text-xs">
											{r.entityType} ·{" "}
											{href ?
												<Link className="text-primary underline-offset-2 hover:underline" href={href}>
													{r.entityId.slice(0, 8)}…
												</Link>
											:	r.entityId.slice(0, 8) + "…"}
										</td>
										<td className="px-3 py-2">{r.source}</td>
										<td className="px-3 py-2">{r.severity}</td>
										<td className="px-3 py-2">{r.status}</td>
										<td className="max-w-md truncate px-3 py-2" title={r.reason ?? ""}>
											{r.reason ?? ""}
										</td>
										<td className="px-3 py-2 text-right">
											{open ?
												<div className="flex flex-wrap justify-end gap-1">
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={busy !== null}
														aria-label={`Mark flag ${r.id} reviewing`}
														onClick={() => void resolve(r.id, "reviewing", "")}
													>
														Review
													</Button>
													<Button
														type="button"
														variant="secondary"
														size="sm"
														disabled={busy !== null}
														aria-label={`Dismiss flag ${r.id}`}
														onClick={() => {
															setDialog({ id: r.id, status: "dismissed" });
															setNotes("");
														}}
													>
														Dismiss
													</Button>
													<Button
														type="button"
														variant="destructive"
														size="sm"
														disabled={busy !== null}
														aria-label={`Uphold flag ${r.id}`}
														onClick={() => {
															setDialog({ id: r.id, status: "upheld" });
															setNotes("");
														}}
													>
														Uphold
													</Button>
												</div>
											:	<span className="text-xs text-muted-foreground">—</span>}
										</td>
									</tr>
								);
							})
						}
					</tbody>
				</table>
			</div>

			<Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{dialog?.status === "upheld" ? "Uphold flag" : "Dismiss flag"}</DialogTitle>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="mod-notes">Resolution notes (optional)</Label>
						<textarea
							id="mod-notes"
							className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
							maxLength={2000}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setDialog(null)}>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={!dialog || busy !== null}
							onClick={() => dialog && void resolve(dialog.id, dialog.status, notes)}
						>
							{busy ? "Saving…" : "Confirm"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
