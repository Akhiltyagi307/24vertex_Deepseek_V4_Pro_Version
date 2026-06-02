"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDestructive } from "@/components/admin/confirm-destructive";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChunkRow = {
	id: string;
	topicId: string;
	content: string;
	chunkType: string;
	sourceRef: string | null;
	createdAt?: string;
};

export function AdminContextChunksEditor({ topicId }: { topicId: string }) {
	const router = useRouter();
	const [rows, setRows] = useState<ChunkRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [content, setContent] = useState("");
	const [chunkType, setChunkType] = useState<"context" | "exercise">("context");
	const [sourceRef, setSourceRef] = useState("");
	const [busy, setBusy] = useState(false);

	// Out-of-order guard: only the most recent load may apply its result, so a
	// slow response (after a topicId change or a post-mutation refresh) can't
	// overwrite newer state.
	const reqIdRef = useRef(0);
	const load = useCallback(async () => {
		const reqId = ++reqIdRef.current;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/admin/context-chunks?topic_id=${encodeURIComponent(topicId)}`, {
				credentials: "include",
			});
			const j = (await res.json()) as { data?: ChunkRow[]; error?: string };
			if (reqId !== reqIdRef.current) return;
			if (!res.ok) {
				setError(j.error ?? res.statusText);
				setRows([]);
				return;
			}
			setRows(j.data ?? []);
		} catch (e) {
			if (reqId !== reqIdRef.current) return;
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			if (reqId === reqIdRef.current) setLoading(false);
		}
	}, [topicId]);

	useEffect(() => {
		void load();
	}, [load]);

	async function createChunk() {
		if (!content.trim()) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/admin/context-chunks", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					topic_id: topicId,
					content: content.trim(),
					chunk_type: chunkType,
					source_ref: sourceRef.trim() || null,
				}),
			});
			// Drain the JSON body so the connection isn't held by an unread stream.
			await res.json().catch(() => null);
			if (!res.ok) {
				setError(await adminHttpErrorMessage(res, res.statusText));
				return;
			}
			setContent("");
			setSourceRef("");
			await load();
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	async function deleteChunk(id: string) {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(`/api/admin/context-chunks/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			const j = (await res.json()) as { error?: string };
			if (!res.ok) {
				setError(j.error ?? res.statusText);
				return;
			}
			await load();
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="space-y-4 rounded-lg border border-border p-4">
			<h2 className="text-base font-semibold">Context chunks</h2>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<div className="grid gap-3 medium:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="chunk-content">Content</Label>
					<textarea
						id="chunk-content"
						className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						value={content}
						onChange={(e) => setContent(e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="chunk-type">Type</Label>
					<select
						id="chunk-type"
						className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
						value={chunkType}
						onChange={(e) => setChunkType(e.target.value as "context" | "exercise")}
					>
						<option value="context">context</option>
						<option value="exercise">exercise</option>
					</select>
					<Label htmlFor="chunk-source">Source ref (optional)</Label>
					<Input id="chunk-source" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
					<Button type="button" disabled={busy || !content.trim()} onClick={() => void createChunk()}>
						Add chunk
					</Button>
				</div>
			</div>
			{loading ?
				<p className="text-sm text-muted-foreground">Loading chunks…</p>
			:	<ul className="space-y-2">
					{rows.length === 0 ?
						<li className="text-sm text-muted-foreground">No chunks for this topic.</li>
					:	rows.map((r) => (
							<li key={r.id} className="rounded-md border border-border/80 p-3 text-sm">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r.chunkType}</span>
									<ConfirmDestructive
										title="Delete this chunk?"
										description="This cannot be undone."
										confirmLabel="Delete"
										onConfirm={() => deleteChunk(r.id)}
									>
										Delete
									</ConfirmDestructive>
								</div>
								<p className="mt-2 line-clamp-4 whitespace-pre-wrap text-muted-foreground">{r.content}</p>
								{r.sourceRef ?
									<p className="mt-1 font-mono text-xs text-muted-foreground">{r.sourceRef}</p>
								:	null}
							</li>
						))
					}
				</ul>
			}
		</section>
	);
}
