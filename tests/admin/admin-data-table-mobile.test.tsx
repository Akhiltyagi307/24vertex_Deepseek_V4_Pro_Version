/** @vitest-environment jsdom */

import type { ColumnDef } from "@tanstack/react-table";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AdminDataTable } from "@/components/admin/data-table/admin-data-table";

describe("AdminDataTable mobile cards", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders mobile card stack with row data", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const columns: ColumnDef<{ name: string }, unknown>[] = [
			{ accessorKey: "name", header: "Name", cell: ({ getValue }) => <span>{String(getValue())}</span> },
		];

		await act(async () => {
			root!.render(
				<AdminDataTable
					columns={columns}
					data={[{ name: "Ada" }]}
					getRowId={(r) => r.name}
					rowCount={1}
					state={{
						pagination: { pageIndex: 0, pageSize: 25 },
						sorting: [],
					}}
					handlers={{
						onPaginationChange: () => {},
						onSortingChange: () => {},
					}}
				/>,
			);
		});

		const mobile = container.querySelector('[data-testid="admin-data-table-mobile-cards"]');
		expect(mobile).toBeTruthy();
		expect(mobile?.textContent).toContain("Ada");
		expect(mobile?.textContent).toContain("Name");
	});
});
