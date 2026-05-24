"use client";

import { useState } from "react";

import { ConfirmDestructive } from "@/components/admin/confirm-destructive";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";

export function SessionsTab({ userId }: { userId: string }) {
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [revoking, setRevoking] = useState(false);

	async function revokeAll() {
		setError(null);
		setSuccess(null);
		setRevoking(true);
		try {
			const res = await fetch(`/api/admin/users/${userId}/revoke-sessions`, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) {
				setError(await adminHttpErrorMessage(res, "Could not revoke sessions"));
				return;
			}
			setSuccess(
				"All refresh tokens for this user were revoked. They must sign in again on every device.",
			);
		} finally {
			setRevoking(false);
		}
	}

	return (
		<section
			aria-labelledby="user-sessions-heading"
			className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
		>
			<div>
				<h2 id="user-sessions-heading" className="text-base font-semibold text-destructive">
					Sign out everywhere
				</h2>
				<p className="mt-1 text-muted-foreground">
					End-user sessions are issued by Supabase Auth. Revoking signs the user out globally on their next
					request. Per-device session lists are not available in this panel yet.
				</p>
			</div>
			{error ?
				<Alert variant="destructive">
					<AlertTitle>Revoke failed</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			:	null}
			{success ?
				<div className="rounded-lg border border-border bg-card px-2.5 py-2 text-sm" role="status">
					<p className="font-medium">Sessions revoked</p>
					<p className="mt-0.5 text-muted-foreground">{success}</p>
				</div>
			:	null}
			<ConfirmDestructive
				title="Revoke all sessions for this user?"
				description="Every browser and app using this account will need to sign in again. This cannot be undone for active devices until they sign in again."
				confirmLabel="Revoke all"
				disabled={revoking}
				onConfirm={revokeAll}
			>
				Revoke all sessions
			</ConfirmDestructive>
		</section>
	);
}
