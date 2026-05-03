"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminAiPromptActions({ id }: { id: string }) {
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	async function activate() {
		setBusy(true);
		setMsg(null);
		try {
			const res = await fetch(`/api/admin/ai/prompts/${id}/activate`, { method: "POST" });
			const j = await res.json();
			if (!res.ok) throw new Error(j.error ?? "Activate failed");
			setMsg("Activated.");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	async function testRun() {
		setBusy(true);
		setMsg(null);
		try {
			const res = await fetch(`/api/admin/ai/prompts/${id}/test`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ user: "Say OK." }),
			});
			const j = await res.json();
			if (!res.ok) throw new Error(j.error ?? "Test failed");
			setMsg(typeof j.text === "string" ? j.text.slice(0, 400) : JSON.stringify(j));
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-wrap gap-2">
			<Button type="button" disabled={busy} variant="secondary" onClick={() => void activate()}>
				Activate
			</Button>
			<Button type="button" disabled={busy} onClick={() => void testRun()}>
				Test call
			</Button>
			{msg ?
				<p className="w-full text-sm text-muted-foreground">{msg}</p>
			:	null}
		</div>
	);
}
