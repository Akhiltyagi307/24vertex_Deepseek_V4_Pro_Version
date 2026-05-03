"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

async function postJson(url: string, body?: unknown) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : "{}",
		credentials: "include",
	});
	const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
	if (!res.ok) throw new Error(j.error ?? res.statusText);
	return j;
}

export function AdminTestDetailActions({ testId }: { testId: string }) {
	const [msg, setMsg] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState<string | null>(null);

	const run = async (label: string, fn: () => Promise<unknown>) => {
		setBusy(label);
		setMsg(null);
		try {
			await fn();
			setMsg(`${label}: ok`);
		} catch (e) {
			setMsg(`${label}: ${e instanceof Error ? e.message : String(e)}`);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-wrap gap-2 border-b border-border pb-4">
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() =>
					void run("regrade", () => postJson(`/api/admin/tests/${testId}/regrade`))
				}
			>
				Regrade
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() =>
					void run("refund", () =>
						postJson(`/api/admin/tests/${testId}/refund-credit`, {
							reason: "admin_panel_manual",
						}),
					)
				}
			>
				Refund credit
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() => void run("extend", () => postJson(`/api/admin/tests/${testId}/extend`, { minutes: 5 }))}
			>
				Extend +5m
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() => void run("pause", () => postJson(`/api/admin/tests/${testId}/pause`))}
			>
				Pause
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() => void run("resume", () => postJson(`/api/admin/tests/${testId}/resume`))}
			>
				Resume
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() =>
					void run("message", () =>
						postJson(`/api/admin/tests/${testId}/message`, { body: "Message from admin." }),
					)
				}
			>
				Send message
			</Button>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				disabled={!!busy}
				onClick={() => void run("force-submit", () => postJson(`/api/admin/tests/${testId}/force-submit`))}
			>
				Force submit
			</Button>
			<Button
				type="button"
				size="sm"
				variant="destructive"
				disabled={!!busy}
				onClick={() => {
					if (!window.confirm("Void this test (mark expired)?")) return;
					void run("void", () => postJson(`/api/admin/tests/${testId}/void`, { refund_credit: false }));
				}}
			>
				Void
			</Button>
			{msg ? <span className="w-full text-xs text-muted-foreground">{msg}</span> : null}
		</div>
	);
}
