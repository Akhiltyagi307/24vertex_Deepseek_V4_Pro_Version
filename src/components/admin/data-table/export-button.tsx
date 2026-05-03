"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { downloadJson, downloadTextFile, rowsToCsv } from "./admin-data-table-helpers";

type ExportButtonProps = {
	filenameBase: string;
	headers: string[];
	/** Rows as plain objects keyed by column id / header name. */
	rows: Record<string, unknown>[];
	disabled?: boolean;
};

export function AdminExportButton({ filenameBase, headers, rows, disabled }: ExportButtonProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || rows.length === 0}
					/>
				}
			>
				<Download className="mr-1.5 size-4" />
				Export
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onSelect={() => {
						const csv = rowsToCsv(headers, rows);
						downloadTextFile(`${filenameBase}.csv`, csv, "text/csv;charset=utf-8");
					}}
				>
					Download CSV
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						downloadJson(`${filenameBase}.json`, rows);
					}}
				>
					Download JSON
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
