/** @vitest-environment jsdom */

import type { ReactElement } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AdminDataTable } from "@/components/admin/data-table/admin-data-table";

const cols: ColumnDef<{ n: string }, unknown>[] = [
	{ accessorKey: "n", header: "Col", cell: ({ getValue }) => <span>{String(getValue())}</span> },
];

function mount(ui: ReactElement) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(ui);
	});
	return { root, container };
}

describe("AdminDataTable states", () => {
	let root: Root | null = null;
	let container: HTMLDivElement | null = null;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		container = null;
		document.body.replaceChildren();
	});

	const baseProps = {
		columns: cols,
		getRowId: (r: { n: string }) => r.n,
		rowCount: 0,
		pageIndex: 0,
		pageSize: 10,
		onPaginationChange: () => {},
		sorting: [] as { id: string; desc: boolean }[],
		onSortingChange: () => {},
	};

	it("shows loading skeleton in mobile and desktop regions", () => {
		const m = mount(
			<AdminDataTable {...baseProps} data={[]} rowCount={0} isLoading emptyLabel="None" />,
		);
		root = m.root;
		container = m.container;
		expect(container.querySelector('[data-testid="admin-data-table-mobile-cards"] .animate-pulse')).toBeTruthy();
		expect(container.querySelector("table .animate-pulse")).toBeTruthy();
	});

	it("shows empty label when not loading", () => {
		const m = mount(<AdminDataTable {...baseProps} data={[]} rowCount={0} isLoading={false} emptyLabel="No rows" />);
		root = m.root;
		container = m.container;
		expect(container.textContent).toContain("No rows");
	});

	it("renders populated rows", () => {
		const m = mount(
			<AdminDataTable
				{...baseProps}
				data={[{ n: "x" }]}
				rowCount={1}
				isLoading={false}
				emptyLabel="No rows"
			/>,
		);
		root = m.root;
		container = m.container;
		expect(container.textContent).toContain("x");
	});
});
