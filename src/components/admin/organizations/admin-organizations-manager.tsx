"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2Icon, CopyIcon, ImageIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { isAbortError } from "@/lib/http/fetch-json";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrganizationType, SerializedOrganizationAdmin } from "@/lib/organizations/schemas";

type FormState = {
	type: OrganizationType;
	name: string;
	external_id: string;
	favicon_url: string;
	is_active: boolean;
};

const emptyForm: FormState = {
	type: "school",
	name: "",
	external_id: "",
	favicon_url: "",
	is_active: true,
};

function toForm(row: SerializedOrganizationAdmin): FormState {
	return {
		type: row.type,
		name: row.name,
		external_id: row.external_id ?? "",
		favicon_url: row.favicon_url ?? "",
		is_active: row.is_active,
	};
}

async function readError(res: Response): Promise<string> {
	try {
		const json = (await res.json()) as { error?: string };
		return json.error ?? res.statusText;
	} catch {
		return res.statusText;
	}
}

export function AdminOrganizationsManager() {
	const [rows, setRows] = useState<SerializedOrganizationAdmin[]>([]);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [confirmRow, setConfirmRow] = useState<SerializedOrganizationAdmin | null>(null);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	async function copyLinkingCode(key: string, code: string) {
		try {
			await navigator.clipboard.writeText(code);
			setCopiedKey(key);
			window.setTimeout(() => {
				setCopiedKey((current) => (current === key ? null : current));
			}, 2000);
		} catch {
			setError("Could not copy linking code to the clipboard.");
		}
	}

	const editingRow = useMemo(
		() => rows.find((row) => row.id === editingId) ?? null,
		[editingId, rows],
	);

	const reqIdRef = useRef(0);
	const acRef = useRef<AbortController | null>(null);

	async function load() {
		const reqId = ++reqIdRef.current;
		acRef.current?.abort();
		const ac = new AbortController();
		acRef.current = ac;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/admin/organizations", { credentials: "include", signal: ac.signal });
			if (!res.ok) throw new Error(await readError(res));
			const json = (await res.json()) as { data: SerializedOrganizationAdmin[] };
			if (reqId !== reqIdRef.current) return;
			setRows(json.data ?? []);
		} catch (e) {
			if (reqId !== reqIdRef.current || isAbortError(e)) return;
			setError(e instanceof Error ? e.message : "Failed to load organizations.");
		} finally {
			if (reqId === reqIdRef.current) setLoading(false);
		}
	}

	useEffect(() => {
		void load();
		return () => {
			acRef.current?.abort();
		};
	}, []);

	function startEdit(row: SerializedOrganizationAdmin) {
		setEditingId(row.id);
		setForm(toForm(row));
		setError(null);
	}

	function resetForm() {
		setEditingId(null);
		setForm(emptyForm);
		setError(null);
	}

	async function submit() {
		setBusy("save");
		setError(null);
		try {
			const payload = {
				type: form.type,
				name: form.name,
				external_id: form.external_id,
				favicon_url: form.favicon_url,
				is_active: form.is_active,
			};
			const res = await fetch(
				editingId ? `/api/admin/organizations/${editingId}` : "/api/admin/organizations",
				{
					method: editingId ? "PATCH" : "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				},
			);
			if (!res.ok) throw new Error(await readError(res));
			resetForm();
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save organization.");
		} finally {
			setBusy(null);
		}
	}

	async function performDeactivate(row: SerializedOrganizationAdmin) {
		setConfirmRow(null);
		setBusy(row.id);
		setError(null);
		try {
			const res = await fetch(`/api/admin/organizations/${row.id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) throw new Error(await readError(res));
			await load();
			if (editingId === row.id) resetForm();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to deactivate organization.");
		} finally {
			setBusy(null);
		}
	}

	async function uploadFavicon(row: SerializedOrganizationAdmin, file: File | null) {
		if (!file) return;
		setBusy(`favicon:${row.id}`);
		setError(null);
		try {
			const fd = new FormData();
			fd.set("file", file);
			const res = await fetch(`/api/admin/organizations/${row.id}/favicon`, {
				method: "POST",
				credentials: "include",
				body: fd,
			});
			if (!res.ok) throw new Error(await readError(res));
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to upload favicon.");
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<div className="grid gap-6 xl:grid-cols-[minmax(280px,380px)_1fr]">
				<div className="rounded-xl border border-border bg-card p-5 shadow-sm">
					<div className="mb-5 flex items-start gap-3">
						<div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
							{editingRow ? <PencilIcon className="size-4" /> : <PlusIcon className="size-4" />}
						</div>
						<div>
							<h2 className="font-semibold tracking-tight">
								{editingRow ? "Edit organization" : "Create organization"}
							</h2>
							<p className="text-sm text-muted-foreground">
								Only active organizations appear in student and teacher pickers. A unique teacher{" "}
								<span className="font-medium text-foreground">linking code</span> is generated when an organization is
								created so teachers can prove affiliation when joining.
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="org-name">Name</Label>
							<Input
								id="org-name"
								value={form.name}
								onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
								placeholder="Delhi Public School"
							/>
						</div>
						<div className="space-y-2">
							<Label>Type</Label>
							<Select
								value={form.type}
								onValueChange={(value) => setForm((cur) => ({ ...cur, type: value as OrganizationType }))}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="school">School</SelectItem>
									<SelectItem value="tuition_center">Tuition center</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{editingRow ? (
							<div className="space-y-2">
								<Label htmlFor="org-linking-code">Teacher linking code</Label>
								<p className="text-muted-foreground text-xs leading-relaxed">
									Read-only. Teachers enter this code with your organization name in Account → School or tuition center.
								</p>
								<div className="flex gap-2">
									<Input
										id="org-linking-code"
										readOnly
										value={editingRow.linking_code}
										className="font-mono tracking-wider"
										aria-describedby="org-linking-code-hint"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										className="shrink-0"
										onClick={() => void copyLinkingCode(`form:${editingRow.id}`, editingRow.linking_code)}
										disabled={Boolean(busy)}
										aria-label="Copy teacher linking code"
									>
										{copiedKey === `form:${editingRow.id}` ? (
											<span className="text-xs font-medium">OK</span>
										) : (
											<CopyIcon className="size-4" />
										)}
									</Button>
								</div>
								<span id="org-linking-code-hint" className="sr-only">
									Copy the linking code to share with teachers
								</span>
							</div>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="org-external">Organization ID (optional)</Label>
							<Input
								id="org-external"
								value={form.external_id}
								onChange={(e) => setForm((cur) => ({ ...cur, external_id: e.target.value }))}
								placeholder="DPS-001"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="org-favicon-url">Favicon URL (optional)</Label>
							<Input
								id="org-favicon-url"
								value={form.favicon_url}
								onChange={(e) => setForm((cur) => ({ ...cur, favicon_url: e.target.value }))}
								placeholder="https://..."
							/>
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={form.is_active}
								onChange={(e) => setForm((cur) => ({ ...cur, is_active: e.target.checked }))}
							/>
							Active in catalog
						</label>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
						<div className="flex flex-wrap gap-2">
							<Button type="button" onClick={() => void submit()} disabled={Boolean(busy)}>
								{busy === "save" ? <Loader2Icon className="animate-spin" /> : null}
								{editingRow ? "Save changes" : "Create organization"}
							</Button>
							{editingRow ? (
								<Button type="button" variant="outline" onClick={resetForm} disabled={Boolean(busy)}>
									Cancel
								</Button>
							) : null}
						</div>
					</div>
				</div>

				<div className="space-y-3">
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading organizations...</p>
					) : rows.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border p-8 text-center">
							<Building2Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
							<p className="font-medium">No organizations yet</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Create a school or tuition center to make it available for connection.
							</p>
						</div>
					) : (
						rows.map((row) => (
							<div
								key={row.id}
								className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm medium:flex-row medium:items-center medium:justify-between"
							>
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
										{row.favicon_url ? (
											// eslint-disable-next-line @next/next/no-img-element -- Admin-managed favicons are dynamic Supabase public URLs.
											<img src={row.favicon_url} alt="" className="size-full object-cover" />
										) : (
											<Building2Icon className="size-4 text-muted-foreground" />
										)}
									</div>
									<div className="min-w-0 flex-1 space-y-2">
										<div>
											<p className="truncate font-medium">{row.name}</p>
											<p className="text-sm text-muted-foreground">
												{row.type_label}
												{row.external_id ? ` · ${row.external_id}` : ""}
												{row.is_active ? "" : " · inactive"}
											</p>
										</div>
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-muted-foreground text-xs uppercase tracking-wide">Link code</span>
											<code className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm tracking-wider">
												{row.linking_code}
											</code>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 px-2"
												onClick={() => void copyLinkingCode(`list:${row.id}`, row.linking_code)}
												disabled={Boolean(busy)}
												aria-label={`Copy linking code for ${row.name}`}
											>
												{copiedKey === `list:${row.id}` ? (
													<span className="text-xs font-medium">Copied</span>
												) : (
													<CopyIcon className="size-4" />
												)}
											</Button>
										</div>
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<label className="inline-flex">
										<input
											type="file"
											accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"
											className="sr-only"
											onChange={(e) => void uploadFavicon(row, e.target.files?.[0] ?? null)}
											disabled={Boolean(busy)}
										/>
										<span className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
											{busy === `favicon:${row.id}` ? <Loader2Icon className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
											Favicon
										</span>
									</label>
									<Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)} disabled={Boolean(busy)}>
										Edit
									</Button>
									<Button type="button" size="sm" variant="destructive" onClick={() => setConfirmRow(row)} disabled={Boolean(busy)}>
										<Trash2Icon className="size-4" />
										Deactivate
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<AlertDialog open={confirmRow !== null} onOpenChange={(open: boolean) => { if (!open) setConfirmRow(null); }}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Deactivate {confirmRow?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Students and teachers will no longer see this organization in pickers. Existing
							student links and teacher memberships will be revoked. This cannot be undone from the
							UI — contact engineering to re-activate.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => { if (confirmRow) void performDeactivate(confirmRow); }}
						>
							Deactivate
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
