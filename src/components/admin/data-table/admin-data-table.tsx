"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type PaginationState,
	type RowSelectionState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminDataTableState = {
	pagination: PaginationState;
	sorting: SortingState;
	/** Optional — only when `options.enableRowSelection` is set. */
	selection?: RowSelectionState;
};

export type AdminDataTableHandlers = {
	onPaginationChange: (p: PaginationState) => void;
	onSortingChange: (s: SortingState) => void;
	/** Required when selection state is provided. */
	onSelectionChange?: (s: RowSelectionState) => void;
};

export type AdminDataTableOptions<T> = {
	isLoading?: boolean;
	emptyLabel?: string;
	className?: string;
	/** Click handler for the entire row (skipped on header / select cell). */
	onRowClick?: (row: T) => void;
	/** j/k row focus, x toggles selection, Enter opens row — only when not typing in an input. */
	enableKeyboardNav?: boolean;
	enableRowSelection?: boolean;
};

export type AdminDataTableProps<T> = {
	columns: ColumnDef<T, unknown>[];
	data: T[];
	/** Total rows server-side (for pagination). */
	rowCount: number;
	getRowId: (row: T, index: number) => string;
	state: AdminDataTableState;
	handlers: AdminDataTableHandlers;
	options?: AdminDataTableOptions<T>;
};

export function AdminDataTable<T>({
	columns,
	data,
	getRowId,
	rowCount,
	state,
	handlers,
	options,
}: AdminDataTableProps<T>) {
	const { pagination, sorting, selection } = state;
	const { pageIndex, pageSize } = pagination;
	const { onPaginationChange, onSortingChange, onSelectionChange } = handlers;
	const {
		isLoading,
		emptyLabel = "No rows",
		className,
		onRowClick,
		enableKeyboardNav = false,
		enableRowSelection = false,
	} = options ?? {};

	const tableWrapRef = useRef<HTMLDivElement>(null);
	const [focusIndex, setFocusIndex] = useState(0);

	const selectionColumns: ColumnDef<T, unknown>[] = useMemo(() => {
		if (!enableRowSelection) return [];
		return [
			{
				id: "__select",
				header: ({ table }) => (
					<input
						type="checkbox"
						className="size-4 rounded border border-input"
						checked={table.getIsAllPageRowsSelected()}
						ref={(el) => {
							if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
						}}
						onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
						aria-label="Select all on page"
					/>
				),
				cell: ({ row }) => (
					<input
						type="checkbox"
						className="size-4 rounded border border-input"
						checked={row.getIsSelected()}
						onChange={(e) => row.toggleSelected(e.target.checked)}
						onClick={(e) => e.stopPropagation()}
						aria-label="Select row"
					/>
				),
				size: 36,
			},
		];
	}, [enableRowSelection]);

	const allColumns = useMemo(() => [...selectionColumns, ...columns], [columns, selectionColumns]);

	// React Compiler skips compilation here: @tanstack/react-table is not yet compiler-aware.
	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data,
		columns: allColumns,
		state: {
			pagination,
			sorting,
			rowSelection: selection ?? {},
		},
		manualPagination: true,
		manualSorting: true,
		rowCount,
		getRowId,
		onPaginationChange: (updater) => {
			const next = typeof updater === "function" ? updater(pagination) : updater;
			onPaginationChange(next);
		},
		onSortingChange: (updater) => {
			const next = typeof updater === "function" ? updater(sorting) : updater;
			onSortingChange(next);
		},
		onRowSelectionChange: onSelectionChange
			? (updater) => {
					const next = typeof updater === "function" ? updater(selection ?? {}) : updater;
					onSelectionChange(next);
				}
			: undefined,
		enableRowSelection,
		getCoreRowModel: getCoreRowModel(),
	});

	const typingInField = useCallback((t: EventTarget | null) => {
		if (!t || !(t instanceof HTMLElement)) return false;
		const tag = t.tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
		if (t.isContentEditable) return true;
		return Boolean(t.closest("[contenteditable='true']"));
	}, []);

	const rowModelRows = table.getRowModel().rows;
	useEffect(() => {
		setFocusIndex((i) => Math.min(i, Math.max(0, rowModelRows.length - 1)));
	}, [rowModelRows.length, pageIndex, data]);

	const onTableKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!enableKeyboardNav || isLoading || data.length === 0) return;
			if (typingInField(e.target)) return;
			const rows = table.getRowModel().rows;
			if (rows.length === 0) return;
			if (e.key === "j" || e.key === "J") {
				e.preventDefault();
				setFocusIndex((i) => Math.min(rows.length - 1, i + 1));
			} else if (e.key === "k" || e.key === "K") {
				e.preventDefault();
				setFocusIndex((i) => Math.max(0, i - 1));
			} else if ((e.key === "x" || e.key === "X") && enableRowSelection && onSelectionChange) {
				e.preventDefault();
				const row = rows[focusIndex];
				if (!row) return;
				const next = { ...(selection ?? {}), [row.id]: !row.getIsSelected() };
				onSelectionChange(next);
			} else if (e.key === "Enter") {
				e.preventDefault();
				const row = rows[focusIndex];
				if (row) onRowClick?.(row.original);
			}
		},
		[
			enableKeyboardNav,
			isLoading,
			data.length,
			table,
			typingInField,
			enableRowSelection,
			onSelectionChange,
			selection,
			focusIndex,
			onRowClick,
		],
	);

	const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));

	function cellLabel(columnId: string, header: unknown): string {
		if (columnId === "__select") return "Select";
		if (typeof header === "string" && header.trim()) return header;
		return columnId.replace(/_/g, " ");
	}

	return (
		<div
			ref={tableWrapRef}
			tabIndex={enableKeyboardNav ? 0 : undefined}
			onKeyDown={enableKeyboardNav ? onTableKeyDown : undefined}
			role={enableKeyboardNav ? "region" : undefined}
			aria-label={enableKeyboardNav ? "Data table with keyboard navigation" : undefined}
			aria-keyshortcuts={enableKeyboardNav ? "j k Enter x" : undefined}
			className={cn(
				"overflow-hidden rounded-lg border border-border",
				enableKeyboardNav && "outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			{/* Mobile: stacked cards (< sm). Desktop: table. */}
			<div className="medium:hidden" data-testid="admin-data-table-mobile-cards">
				{isLoading ?
					<div className="divide-y divide-border">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={`msk-${i}`} className="space-y-2 p-3">
								{allColumns.map((c) => (
									<div key={c.id ?? String(i)} className="h-4 animate-pulse rounded bg-muted" />
								))}
							</div>
						))}
					</div>
				: data.length === 0 ?
					<p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
				:	<div className="divide-y divide-border">
						{table.getRowModel().rows.map((row) => (
							<div
								key={row.id}
								className={cn(
									"space-y-2 p-3",
									onRowClick && "cursor-pointer active:bg-muted/40",
									row.getIsSelected() && "bg-primary/5",
								)}
								onClick={() => onRowClick?.(row.original)}
							>
								{row.getVisibleCells().map((cell) => {
									const hdr = cell.column.columnDef.header;
									const label = cellLabel(cell.column.id, hdr);
									if (cell.column.id === "__select") {
										return (
											<div key={cell.id} className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
												<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</div>
										);
									}
									return (
										<div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
											<span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
												{label}
											</span>
											<div className="min-w-0 flex-1 text-right">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
										</div>
									);
								})}
							</div>
						))}
					</div>
				}
			</div>
			<div className="hidden overflow-x-auto medium:block">
				<table className="w-full min-w-[640px] border-collapse text-sm">
					<thead>
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id} className="border-b border-border bg-muted/40">
								{hg.headers.map((h) => (
									<th
										key={h.id}
										className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
										style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
									>
										{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{isLoading ?
							Array.from({ length: 8 }).map((_, i) => (
								<tr key={`sk-${i}`} className="border-b border-border">
									{allColumns.map((c) => (
										<td key={c.id ?? String(i)} className="px-3 py-3">
											<div className="h-4 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						: data.length === 0 ?
							<tr>
								<td colSpan={allColumns.length} className="px-4 py-12 text-center text-muted-foreground">
									{emptyLabel}
								</td>
							</tr>
						:	table.getRowModel().rows.map((row, ri) => (
								<tr
									key={row.id}
									className={cn(
										"border-b border-border transition-colors hover:bg-muted/30",
										onRowClick && "cursor-pointer",
										row.getIsSelected() && "bg-primary/5",
										enableKeyboardNav && ri === focusIndex && "bg-accent/30 ring-1 ring-inset ring-ring/40",
									)}
									onClick={() => onRowClick?.(row.original)}
								>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id} className="px-3 py-2 align-middle">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))
						}
					</tbody>
				</table>
			</div>
			<div className="flex flex-col gap-2 border-t border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground medium:flex-row medium:items-center medium:justify-between">
				<div>
					Showing {rowCount === 0 ? 0 : pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, rowCount)} of{" "}
					{rowCount}
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pageIndex <= 0}
						onClick={() => onPaginationChange({ pageIndex: pageIndex - 1, pageSize })}
					>
						<ChevronLeft className="size-4" />
					</Button>
					<span className="tabular-nums">
						Page {pageIndex + 1} / {pageCount}
					</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pageIndex + 1 >= pageCount}
						onClick={() => onPaginationChange({ pageIndex: pageIndex + 1, pageSize })}
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
