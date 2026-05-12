"use client";

import * as React from "react";

import { LatexText } from "../../latex-text";
import { cn } from "@/lib/utils";
import type { DataTableSpec } from "@/lib/practice/visuals/types";

/**
 * `data_table` renderer — a generic stimulus table.
 *
 * Headers in row 1, 2D rows of cells with `value`, `bold`, and `align`
 * controls per cell. Useful for short statistical tables, English unseen
 * passages with sub-tables, science observation sheets, etc.
 */
export function DataTable({ spec }: { spec: DataTableSpec }): React.ReactElement {
	return (
		<div className="w-full max-w-[640px]">
			{spec.caption ? (
				<div className="text-foreground mb-1 text-center text-sm font-semibold">
					<LatexText text={spec.caption} className="justify-center text-center" />
				</div>
			) : null}
			<table className="w-full border-collapse text-sm tabular-nums">
				<thead>
					<tr>
						{spec.headers.map((header, i) => (
							<th
								key={`h-${i}`}
								className="border border-border bg-muted/40 px-2 py-1 text-left font-semibold"
							>
								<LatexText text={header} />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{spec.rows.map((row, ri) => (
						<tr key={`r-${ri}`}>
							{row.map((cell, ci) => (
								<td
									key={`c-${ri}-${ci}`}
									className={cn(
										"border border-border px-2 py-1",
										cell.bold && "font-semibold",
										cell.align === "right" && "text-right",
										cell.align === "center" && "text-center",
										cell.align === "left" && "text-left",
									)}
								>
									<LatexText text={cell.value} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
