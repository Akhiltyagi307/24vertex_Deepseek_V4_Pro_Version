"use client";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { Button } from "@/components/ui/button";

type Props = {
	selectedCount: number;
	exportHeaders: string[];
	exportRows: Record<string, unknown>[];
	filenameBase: string;
	disabled?: boolean;
	onClear: () => void;
};

export function AdminUsersBulkToolbar({
	selectedCount,
	exportHeaders,
	exportRows,
	filenameBase,
	disabled,
	onClear,
}: Props) {
	if (selectedCount === 0) return null;

	return (
		<div
			className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
			role="region"
			aria-label="Bulk actions"
		>
			<span className="text-muted-foreground">
				<span className="font-medium text-foreground">{selectedCount}</span> selected
			</span>
			<AdminExportButton
				filenameBase={filenameBase}
				headers={exportHeaders}
				rows={exportRows}
				disabled={disabled}
			/>
			<Button type="button" variant="ghost" size="sm" onClick={onClear}>
				Clear selection
			</Button>
		</div>
	);
}
