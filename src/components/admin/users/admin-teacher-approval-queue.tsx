"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { Button } from "@/components/ui/button";
import { fetchJson, isAbortError } from "@/lib/http/fetch-json";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

type Row = {
	id: string;
	email: string | null;
	full_name: string;
	phone: string | null;
	school_name: string | null;
	created_at: string | null;
};

const pendingTeachersResponseSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			email: z.string().nullable(),
			full_name: z.string(),
			phone: z.string().nullable(),
			school_name: z.string().nullable(),
			created_at: z.string().nullable(),
		}),
	),
});

export function AdminTeacherApprovalQueue() {
	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);

	const reqIdRef = useRef(0);
	const acRef = useRef<AbortController | null>(null);

	const load = async () => {
		const reqId = ++reqIdRef.current;
		acRef.current?.abort();
		const ac = new AbortController();
		acRef.current = ac;
		setLoading(true);
		try {
			const j = await fetchJson("/api/admin/teachers/pending", {
				schema: pendingTeachersResponseSchema,
				signal: ac.signal,
				init: { credentials: "include" },
			});
			if (reqId !== reqIdRef.current) return;
			setRows(j.data ?? []);
		} catch (err) {
			if (isAbortError(err) || reqId !== reqIdRef.current) return;
			// Match the previous behaviour: a failed load leaves the existing rows.
		} finally {
			if (reqId === reqIdRef.current) setLoading(false);
		}
	};

	useEffect(() => {
		void load();
		return () => {
			acRef.current?.abort();
		};
	}, []);

	const approve = async (id: string) => {
		setBusy(id);
		try {
			const res = await fetch(`/api/admin/teachers/${id}/approve`, { method: "POST", credentials: "include" });
			if (!res.ok) {
				toast.error(await adminHttpErrorMessage(res, "Could not approve this teacher"));
				return;
			}
			toast.success("Teacher approved.");
			await load();
		} catch {
			toast.error("Network error. Try again.");
		} finally {
			setBusy(null);
		}
	};

	const reject = async (id: string) => {
		const reason = window.prompt("Rejection reason (required):")?.trim();
		if (!reason) return;
		setBusy(id);
		try {
			const res = await fetch(`/api/admin/teachers/${id}/reject`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			});
			if (!res.ok) {
				toast.error(await adminHttpErrorMessage(res, "Could not reject this teacher"));
				return;
			}
			toast.success("Teacher rejected.");
			await load();
		} catch {
			toast.error("Network error. Try again.");
		} finally {
			setBusy(null);
		}
	};

	const requestInfo = async (id: string) => {
		const raw = window.prompt("Questions for teacher (one per line):")?.trim();
		if (!raw) return;
		const questions = raw.split("\n").map((s) => s.trim()).filter(Boolean);
		if (questions.length === 0) return;
		setBusy(id);
		try {
			const res = await fetch(`/api/admin/teachers/${id}/request-info`, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ questions }),
			});
			if (!res.ok) {
				toast.error(await adminHttpErrorMessage(res, "Could not send request"));
				return;
			}
			toast.success("Request sent to teacher.");
			await load();
		} catch {
			toast.error("Network error. Try again.");
		} finally {
			setBusy(null);
		}
	};

	const exportRows = rows.map((r) => ({
		id: r.id,
		email: r.email ?? "",
		full_name: r.full_name,
		phone: r.phone ?? "",
		school_name: r.school_name ?? "",
		created_at: r.created_at ?? "",
	}));

	if (loading) {
		return (
			<div className="space-y-3">
				<div className="flex flex-wrap justify-end gap-2">
					<AdminSavedViews listId={ADMIN_LIST_ID.teacherApprovals} />
					<AdminExportButton
						filenameBase="teacher-approvals"
						headers={["id", "email", "phone", "full_name", "school_name", "created_at"]}
						rows={[]}
						disabled
					/>
				</div>
				<p className="text-sm text-muted-foreground">Loading queue…</p>
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="space-y-3">
				<div className="flex flex-wrap justify-end gap-2">
					<AdminSavedViews listId={ADMIN_LIST_ID.teacherApprovals} />
					<AdminExportButton
						filenameBase="teacher-approvals"
						headers={["id", "email", "phone", "full_name", "school_name", "created_at"]}
						rows={[]}
						disabled
					/>
				</div>
				<p className="text-sm text-muted-foreground">No pending teacher approvals.</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap justify-end gap-2">
				<AdminSavedViews listId={ADMIN_LIST_ID.teacherApprovals} />
				<AdminExportButton
					filenameBase="teacher-approvals"
					headers={["id", "email", "phone", "full_name", "school_name", "created_at"]}
					rows={exportRows}
				/>
			</div>
			{rows.map((r) => (
				<div key={r.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 medium:flex-row medium:items-center medium:justify-between">
					<div>
						<p className="font-medium">{r.full_name}</p>
						<p className="text-sm text-muted-foreground">{r.email ?? "—"}</p>
						<p className="text-sm text-muted-foreground">{r.phone ?? "—"}</p>
						<p className="text-xs text-muted-foreground">{r.school_name ?? "School not set"}</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="button" size="sm" disabled={busy !== null} onClick={() => void approve(r.id)}>
							Approve
						</Button>
						<Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void requestInfo(r.id)}>
							Request info
						</Button>
						<Button type="button" size="sm" variant="destructive" disabled={busy !== null} onClick={() => void reject(r.id)}>
							Reject
						</Button>
						{r.school_name ?
							<Button
								type="button"
								size="sm"
								variant="secondary"
								render={
									<a
										href={`https://www.google.com/search?q=${encodeURIComponent(r.school_name)}`}
										target="_blank"
										rel="noreferrer"
									/>
								}
							>
								Search school
							</Button>
						:	null}
					</div>
				</div>
			))}
		</div>
	);
}
