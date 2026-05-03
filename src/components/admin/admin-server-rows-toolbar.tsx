"use client";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";

type Props = {
	listId: string;
	filenameBase: string;
	headers: string[];
	rows: Record<string, unknown>[];
};

/**
 * Saved views + CSV/JSON export for server-rendered list pages (toolbar reads URL via `useSearchParams`).
 */
export function AdminServerRowsToolbar({ listId, filenameBase, headers, rows }: Props) {
	return (
		<div className="mb-3 flex flex-wrap items-center justify-end gap-2">
			<AdminSavedViews listId={listId} />
			<AdminExportButton filenameBase={filenameBase} headers={headers} rows={rows} disabled={rows.length === 0} />
		</div>
	);
}
