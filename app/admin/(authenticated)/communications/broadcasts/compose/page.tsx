"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminBroadcastComposePage() {
	const router = useRouter();
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [kind, setKind] = useState<"students" | "all">("students");
	const [channels, setChannels] = useState({ in_app: true, email: false, priority_urgent: false });
	const [busy, setBusy] = useState(false);
	const [previewCount, setPreviewCount] = useState<number | null>(null);
	const [err, setErr] = useState<string | null>(null);

	async function preview() {
		setErr(null);
		const res = await fetch("/api/admin/broadcasts/preview", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				audience: { kind },
			}),
		});
		const j = (await res.json()) as { count?: number; error?: string };
		if (!res.ok) {
			setErr(j.error ?? "Preview failed");
			return;
		}
		setPreviewCount(j.count ?? 0);
	}

	async function saveDraft() {
		setBusy(true);
		setErr(null);
		try {
			const res = await fetch("/api/admin/broadcasts", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					subject,
					body_md: body,
					audience: { kind },
					channels,
				}),
			});
			const j = (await res.json()) as { data?: { id: string }; error?: string };
			if (!res.ok) throw new Error(j.error ?? "Save failed");
			router.push("/admin/communications/broadcasts");
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Save failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto max-w-3xl space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Compose broadcast</h1>
				<p className="text-sm text-muted-foreground">Markdown body; choose channels and audience.</p>
			</div>
			{err ?
				<p className="text-sm text-red-600">{err}</p>
			:	null}
			<label className="block space-y-1">
				<span className="text-sm font-medium">Audience</span>
				<select
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					value={kind}
					onChange={(e) => setKind(e.target.value as "students" | "all")}
				>
					<option value="students">Students</option>
					<option value="all">All roles</option>
				</select>
			</label>
			<div className="flex flex-wrap gap-4 text-sm">
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={channels.in_app}
						onChange={(e) => setChannels((c) => ({ ...c, in_app: e.target.checked }))}
					/>
					In-app
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={channels.email}
						onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))}
					/>
					Email
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={channels.priority_urgent}
						onChange={(e) => setChannels((c) => ({ ...c, priority_urgent: e.target.checked }))}
					/>
					Urgent
				</label>
			</div>
			<button
				type="button"
				className="rounded-md border border-border px-3 py-1.5 text-sm"
				onClick={() => void preview()}
			>
				Preview audience count
			</button>
			{previewCount !== null ?
				<p className="text-sm text-muted-foreground">Estimated recipients: {previewCount}</p>
			:	null}
			<label className="block space-y-1">
				<span className="text-sm font-medium">Subject</span>
				<input
					className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
				/>
			</label>
			<label className="block space-y-1">
				<span className="text-sm font-medium">Body (Markdown)</span>
				<textarea
					className="min-h-[200px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
					value={body}
					onChange={(e) => setBody(e.target.value)}
				/>
			</label>
			<button
				type="button"
				disabled={busy || !subject.trim() || !body.trim()}
				className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
				onClick={() => void saveDraft()}
			>
				{busy ? "Saving…" : "Save draft"}
			</button>
		</div>
	);
}
