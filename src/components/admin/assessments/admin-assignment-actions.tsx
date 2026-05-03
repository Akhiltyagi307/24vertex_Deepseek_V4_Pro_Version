"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

async function post(url: string) {
	const res = await fetch(url, { method: "POST", credentials: "include" });
	const j = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok) throw new Error(j.error ?? res.statusText);
}

export function AdminAssignmentActions({ assignmentId }: { assignmentId: string }) {
	const [msg, setMsg] = React.useState<string | null>(null);

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				size="sm"
				variant="secondary"
				onClick={async () => {
					try {
						await post(`/api/admin/assignments/${assignmentId}/force-close`);
						setMsg("Closed.");
					} catch (e) {
						setMsg(e instanceof Error ? e.message : String(e));
					}
				}}
			>
				Force close
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				onClick={async () => {
					try {
						await post(`/api/admin/assignments/${assignmentId}/restore`);
						setMsg("Restored to active.");
					} catch (e) {
						setMsg(e instanceof Error ? e.message : String(e));
					}
				}}
			>
				Restore active
			</Button>
			{msg ? <span className="w-full text-xs text-muted-foreground">{msg}</span> : null}
		</div>
	);
}
