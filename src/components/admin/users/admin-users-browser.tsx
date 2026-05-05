"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, PaginationState, RowSelectionState, SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AdminDataTable } from "@/components/admin/data-table/admin-data-table";
import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminFilterBar } from "@/components/admin/data-table/filter-bar";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { AdminUsersBulkToolbar } from "@/components/admin/users/admin-users-bulk-toolbar";
import { StatusChip } from "@/components/admin/status-chip";
import type { AdminUserListRole, AdminUserListRow } from "@/lib/admin/users-list";

type Props = {
	listId: string;
	role: AdminUserListRole;
	title: string;
};

export function AdminUsersBrowser({ listId, role, title }: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
	const pageSize = Math.min(250, Math.max(1, Number(searchParams.get("page_size") ?? "25") || 25));
	const sort = searchParams.get("sort") ?? "";

	const [rows, setRows] = useState<AdminUserListRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const fetchPage = useCallback(async () => {
		setRowSelection({});
		setLoading(true);
		setError(null);
		const p = new URLSearchParams();
		p.set("role", role);
		p.set("page", String(page));
		p.set("page_size", String(pageSize));
		const q = searchParams.get("q");
		if (q) p.set("q", q);
		const grade = searchParams.get("grade");
		if (grade) p.set("grade", grade);
		const section = searchParams.get("section");
		if (section) p.set("section", section);
		const stream = searchParams.get("stream");
		if (stream) p.set("stream", stream);
		if (searchParams.get("include_deleted") === "1") p.set("include_deleted", "1");
		if (searchParams.get("include_suspended") === "1") p.set("include_suspended", "1");
		if (sort) p.set("sort", sort);

		const res = await fetch(`/api/admin/users?${p.toString()}`, { credentials: "include" });
		if (!res.ok) {
			setError("Failed to load users");
			setRows([]);
			setTotal(0);
			setLoading(false);
			return;
		}
		const j = (await res.json()) as { data: AdminUserListRow[]; total: number };
		setRows(j.data ?? []);
		setTotal(Number(j.total ?? 0));
		setLoading(false);
	}, [page, pageSize, role, searchParams, sort]);

	useEffect(() => {
		startTransition(() => {
			void fetchPage();
		});
	}, [fetchPage]);

	const setPage = (next: PaginationState) => {
		const p = new URLSearchParams(searchParams.toString());
		p.set("page", String(next.pageIndex + 1));
		p.set("page_size", String(next.pageSize));
		router.push(`${pathname}?${p.toString()}`);
	};

	const sorting: SortingState = useMemo(() => {
		if (sort === "name_asc") return [{ id: "full_name", desc: false }];
		if (sort === "name_desc") return [{ id: "full_name", desc: true }];
		if (sort === "created_at_asc") return [{ id: "created_at", desc: false }];
		return [{ id: "last_active_at", desc: true }];
	}, [sort]);

	const onSortingChange = (s: SortingState) => {
		const p = new URLSearchParams(searchParams.toString());
		const first = s[0];
		if (!first) {
			p.delete("sort");
		} else if (first.id === "full_name") {
			p.set("sort", first.desc ? "name_desc" : "name_asc");
		} else if (first.id === "created_at") {
			p.set("sort", first.desc ? "" : "created_at_asc");
		} else {
			p.delete("sort");
		}
		p.set("page", "1");
		router.push(`${pathname}?${p.toString()}`);
	};

	const columns = useMemo<ColumnDef<AdminUserListRow, unknown>[]>(
		() => [
			{
				id: "full_name",
				accessorKey: "full_name",
				header: "Name",
				cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span>,
			},
			{
				id: "email",
				accessorKey: "email",
				header: "Email",
				cell: ({ row }) => <span className="text-muted-foreground">{row.original.email ?? "—"}</span>,
			},
			{
				id: "grade",
				header: "Grade",
				cell: ({ row }) => <span className="tabular-nums">{row.original.grade ?? "—"}</span>,
			},
			{
				id: "section",
				accessorKey: "section",
				header: "Section",
				cell: ({ row }) => row.original.section ?? "—",
			},
			{
				id: "stream",
				accessorKey: "stream",
				header: "Stream",
				cell: ({ row }) => row.original.stream ?? "—",
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => {
					const r = row.original;
					if (r.deleted_at) return <StatusChip status="bad" label="Deleted" />;
					if (r.is_suspended) return <StatusChip status="warn" label="Suspended" />;
					return <StatusChip status="good" label="Active" />;
				},
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Link className="text-primary text-xs font-medium hover:underline" href={`/admin/users/${row.original.id}`}>
						View
					</Link>
				),
			},
		],
		[],
	);

	const exportHeaders = [
		"id",
		"email",
		"full_name",
		"role",
		"grade",
		"section",
		"stream",
		"is_suspended",
		"deleted_at",
		"last_active_at",
	];
	const exportRows = rows.map((r) => ({
		id: r.id,
		email: r.email ?? "",
		full_name: r.full_name,
		role: r.role,
		grade: r.grade ?? "",
		section: r.section ?? "",
		stream: r.stream ?? "",
		is_suspended: r.is_suspended,
		deleted_at: r.deleted_at ?? "",
		last_active_at: r.last_active_at ?? "",
	}));

	const selectedIds = useMemo(
		() => Object.entries(rowSelection).filter(([, on]) => on).map(([id]) => id),
		[rowSelection],
	);
	const selectedExportRows = useMemo(() => {
		const set = new Set(selectedIds);
		return exportRows.filter((r) => set.has(String(r.id)));
	}, [exportRows, selectedIds]);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 medium:flex-row medium:items-center medium:justify-between">
				{title ?
					<h2 className="text-lg font-semibold tracking-tight medium:hidden">{title}</h2>
				:	null}
				<div className="ml-auto flex flex-wrap gap-2">
					<AdminSavedViews listId={listId} />
					<AdminExportButton filenameBase={`${listId}-export`} headers={exportHeaders} rows={exportRows} disabled={loading} />
				</div>
			</div>
			<AdminFilterBar>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={searchParams.get("include_deleted") === "1"}
						onChange={(e) => {
							const p = new URLSearchParams(searchParams.toString());
							if (e.target.checked) p.set("include_deleted", "1");
							else p.delete("include_deleted");
							p.set("page", "1");
							router.push(`${pathname}?${p.toString()}`);
						}}
					/>
					Include deleted
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={searchParams.get("include_suspended") === "1"}
						onChange={(e) => {
							const p = new URLSearchParams(searchParams.toString());
							if (e.target.checked) p.set("include_suspended", "1");
							else p.delete("include_suspended");
							p.set("page", "1");
							router.push(`${pathname}?${p.toString()}`);
						}}
					/>
					Include suspended
				</label>
			</AdminFilterBar>
			{error ?
				<p className="text-sm text-destructive">{error}</p>
			:	null}
			<AdminUsersBulkToolbar
				selectedCount={selectedIds.length}
				exportHeaders={exportHeaders}
				exportRows={selectedExportRows}
				filenameBase={`${listId}-selected`}
				disabled={loading}
				onClear={() => setRowSelection({})}
			/>
			<AdminDataTable
				columns={columns}
				data={rows}
				getRowId={(r) => r.id}
				rowCount={total}
				state={{
					pagination: { pageIndex: page - 1, pageSize },
					sorting,
					selection: rowSelection,
				}}
				handlers={{
					onPaginationChange: setPage,
					onSortingChange,
					onSelectionChange: setRowSelection,
				}}
				options={{
					isLoading: loading,
					emptyLabel: "No users match filters.",
					enableRowSelection: true,
					enableKeyboardNav: true,
					onRowClick: (r) => router.push(`/admin/users/${r.id}`),
				}}
			/>
		</div>
	);
}
