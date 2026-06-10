"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { DestructiveConfirm } from "@/components/admin/destructive-confirm";
import { Button } from "@/components/ui/button";

type Props = {
	userId: string;
	email: string | null;
	totpRequired: boolean;
};

export function AdminUserDangerZone({ userId, email, totpRequired }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [suspendOpen, setSuspendOpen] = useState(false);
	const [hardOpen, setHardOpen] = useState(false);
	const [impOpen, setImpOpen] = useState(false);

	const post = async (path: string, body?: object) => {
		const res = await fetch(path, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		});
		const j = (await res.json().catch(() => ({}))) as { error?: string };
		if (!res.ok) throw new Error(j.error ?? res.statusText);
	};

	return (
		<div className="space-y-6 border-l-4 border-destructive/60 pl-4">
			<div>
				<h3 className="text-sm font-semibold text-destructive">Suspend account</h3>
				<p className="mt-1 text-sm text-muted-foreground">Blocks portal access until unsuspended.</p>
				<Button type="button" variant="destructive" size="sm" className="mt-2" onClick={() => setSuspendOpen(true)}>
					Suspend…
				</Button>
			</div>
			<div>
				<h3 className="text-sm font-semibold">Unsuspend</h3>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="mt-2"
					disabled={busy !== null}
					onClick={async () => {
						setBusy("unsuspend");
						try {
							await post(`/api/admin/users/${userId}/unsuspend`);
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Unsuspend
				</Button>
			</div>
			<div>
				<h3 className="text-sm font-semibold text-destructive">Soft delete (anonymize)</h3>
				<p className="mt-1 text-sm text-muted-foreground">Clears PII and sets deleted_at.</p>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					className="mt-2"
					disabled={busy !== null}
					onClick={async () => {
						if (!confirm("Soft-delete this user?")) return;
						setBusy("soft");
						try {
							await post(`/api/admin/users/${userId}/soft-delete`);
							router.refresh();
						} catch (e) {
							alert(e instanceof Error ? e.message : "Failed");
						} finally {
							setBusy(null);
						}
					}}
				>
					Soft delete
				</Button>
			</div>
			<div>
				<h3 className="text-sm font-semibold text-destructive">Hard delete</h3>
				<p className="mt-1 text-sm text-muted-foreground">Removes the auth user and cascades data. Cannot be undone.</p>
				<Button type="button" variant="destructive" size="sm" className="mt-2" onClick={() => setHardOpen(true)}>
					Hard delete…
				</Button>
			</div>
			<div>
				<h3 className="text-sm font-semibold">Impersonate</h3>
				<p className="mt-1 text-sm text-muted-foreground">Opens a magic link for this user in a new tab. Requires a TOTP code.</p>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="mt-2"
					disabled={!email || busy !== null}
					onClick={() => setImpOpen(true)}
				>
					Open magic link…
				</Button>
			</div>

			<DestructiveConfirm
				open={suspendOpen}
				onOpenChange={setSuspendOpen}
				title="Suspend user"
				description="They will be blocked from student/parent/teacher portals on next navigation."
				confirmText="SUSPEND"
				onConfirm={async () => {
					await post(`/api/admin/users/${userId}/suspend`, {});
					router.refresh();
				}}
				submitLabel="Suspend user"
			/>

			<DestructiveConfirm
				open={hardOpen}
				onOpenChange={setHardOpen}
				title="Hard delete user"
				description="This permanently deletes the account. Type the user email exactly."
				confirmText={email ?? ""}
				requireTotp={totpRequired}
				onConfirm={async ({ totp: t }) => {
					await post(`/api/admin/users/${userId}/hard-delete`, {
						confirm_email: email ?? "",
						totp: t,
					});
					router.push("/admin/users/students");
				}}
				submitLabel="Delete forever"
			/>

			<DestructiveConfirm
				open={impOpen}
				onOpenChange={setImpOpen}
				title="Impersonate user"
				description="Mints a one-time magic link that signs you in AS this user. Type the user email and a fresh TOTP code."
				confirmText={email ?? ""}
				requireTotp
				onConfirm={async ({ totp: t }) => {
					const res = await fetch(`/api/admin/users/${userId}/impersonate`, {
						method: "POST",
						credentials: "include",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ totp: t }),
					});
					const j = (await res.json().catch(() => ({}))) as { magic_link?: string; error?: string };
					if (!res.ok || !j.magic_link) throw new Error(j.error ?? "Failed");
					window.open(j.magic_link, "_blank", "noopener,noreferrer");
				}}
				submitLabel="Open magic link"
			/>
		</div>
	);
}
