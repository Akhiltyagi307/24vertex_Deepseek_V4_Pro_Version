"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ComplianceRequestDetailActions({
	requestId,
	requestType,
	identityVerified,
	hasSubjectUserId,
}: {
	requestId: string;
	requestType: string;
	identityVerified: boolean;
	hasSubjectUserId: boolean;
}) {
	const router = useRouter();
	const [msg, setMsg] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	async function postJson(url: string, body: unknown) {
		setBusy(url);
		setMsg(null);
		try {
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const j = await res.json().catch(() => ({}));
			if (!res.ok) {
				setMsg(j.error ? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)) : res.statusText);
				return;
			}
			setMsg(JSON.stringify(j, null, 2));
			router.refresh();
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(null);
		}
	}

	const gated = identityVerified && hasSubjectUserId;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="secondary"
					size="sm"
					disabled={!gated || busy !== null}
					onClick={() => void postJson(`/api/admin/compliance/requests/${requestId}/export`, {})}
				>
					Generate access export (ZIP)
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!gated || requestType !== "erasure" || busy !== null}
					onClick={() => void postJson(`/api/admin/compliance/requests/${requestId}/erase`, { dry_run: true })}
				>
					Erasure dry-run
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={!gated || requestType !== "erasure" || busy !== null}
					onClick={() => {
						if (!confirm("Commit erasure? This cannot be undone (payments and audit logs are retained).")) return;
						void postJson(`/api/admin/compliance/requests/${requestId}/erase`, {
							dry_run: false,
							idempotency_key: crypto.randomUUID(),
						});
					}}
				>
					Commit erasure
				</Button>
			</div>
			{msg ? <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{msg}</pre> : null}
		</div>
	);
}
