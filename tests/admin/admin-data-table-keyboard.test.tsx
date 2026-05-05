/** @vitest-environment jsdom */

/**
 * Keyboard navigation tests for AdminDataTable.
 *
 * Covers j/k row focus, x toggle-selection, Enter open-row, and the
 * "typing in a field" guard that prevents shortcuts from firing while
 * the user is editing an input.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

import { AdminDataTable } from "@/components/admin/data-table/admin-data-table";

type Row = { id: string; name: string };

const COLUMNS: ColumnDef<Row, unknown>[] = [
	{ accessorKey: "name", header: "Name", cell: ({ getValue }) => <span>{String(getValue())}</span> },
];

const ROWS: Row[] = [
	{ id: "r1", name: "Ada" },
	{ id: "r2", name: "Boole" },
	{ id: "r3", name: "Codd" },
];

let container: HTMLDivElement;
let root: Root;

function dispatchKey(target: HTMLElement, key: string) {
	target.dispatchEvent(
		new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
	);
}

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	if (container.parentNode) container.parentNode.removeChild(container);
});

function mountTable(opts: {
	onRowClick?: (row: Row) => void;
	onSelectionChange?: (sel: Record<string, boolean>) => void;
	enableRowSelection?: boolean;
}) {
	const onRowClick = opts.onRowClick ?? vi.fn();
	const onSelectionChange = opts.onSelectionChange ?? vi.fn();
	act(() => {
		root.render(
			<AdminDataTable
				columns={COLUMNS}
				data={ROWS}
				getRowId={(r) => r.id}
				rowCount={ROWS.length}
				state={{
					pagination: { pageIndex: 0, pageSize: 25 },
					sorting: [],
					selection: {},
				}}
				handlers={{
					onPaginationChange: () => undefined,
					onSortingChange: () => undefined,
					onSelectionChange,
				}}
				options={{
					enableKeyboardNav: true,
					enableRowSelection: opts.enableRowSelection ?? false,
					onRowClick,
				}}
			/>,
		);
	});
	return { onRowClick, onSelectionChange };
}

function getTableWrap(): HTMLElement {
	const el = container.querySelector('[tabindex="0"]') as HTMLElement | null;
	if (!el) throw new Error("table wrap with tabindex=0 not found");
	return el;
}

function getDesktopRows(): HTMLTableRowElement[] {
	return Array.from(container.querySelectorAll("table tbody tr"));
}

function focusedRowIndex(): number {
	const rows = getDesktopRows();
	return rows.findIndex((r) => /bg-accent\/30/.test(r.className));
}

describe("AdminDataTable — keyboard navigation", () => {
	it("starts with focus index 0 (no row visually focused initially) and `j` advances", () => {
		mountTable({});
		// j advances focus to row 1.
		act(() => dispatchKey(getTableWrap(), "j"));
		expect(focusedRowIndex()).toBe(1);
		// Another j advances to row 2.
		act(() => dispatchKey(getTableWrap(), "j"));
		expect(focusedRowIndex()).toBe(2);
	});

	it("`j` does not advance past the last row", () => {
		mountTable({});
		for (let i = 0; i < 10; i++) act(() => dispatchKey(getTableWrap(), "j"));
		expect(focusedRowIndex()).toBe(ROWS.length - 1);
	});

	it("`k` decrements focus and clamps at 0", () => {
		mountTable({});
		act(() => dispatchKey(getTableWrap(), "j"));
		act(() => dispatchKey(getTableWrap(), "j"));
		expect(focusedRowIndex()).toBe(2);
		act(() => dispatchKey(getTableWrap(), "k"));
		expect(focusedRowIndex()).toBe(1);
		for (let i = 0; i < 5; i++) act(() => dispatchKey(getTableWrap(), "k"));
		expect(focusedRowIndex()).toBe(0);
	});

	it("Enter calls onRowClick with the focused row", () => {
		const { onRowClick } = mountTable({});
		act(() => dispatchKey(getTableWrap(), "j"));
		act(() => dispatchKey(getTableWrap(), "Enter"));
		expect(onRowClick).toHaveBeenCalledTimes(1);
		expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
	});

	it("`x` toggles selection on the focused row when row selection is enabled", () => {
		const { onSelectionChange } = mountTable({ enableRowSelection: true });
		act(() => dispatchKey(getTableWrap(), "j"));
		act(() => dispatchKey(getTableWrap(), "x"));
		expect(onSelectionChange).toHaveBeenCalledTimes(1);
		expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ r2: true }));
	});

	it("`x` is a no-op when row selection is disabled", () => {
		const { onSelectionChange } = mountTable({ enableRowSelection: false });
		act(() => dispatchKey(getTableWrap(), "j"));
		act(() => dispatchKey(getTableWrap(), "x"));
		expect(onSelectionChange).not.toHaveBeenCalled();
	});

	it("typing in an INPUT inside the table does not consume shortcuts", () => {
		const { onRowClick } = mountTable({});
		act(() => dispatchKey(getTableWrap(), "j"));
		// Inject an input + dispatch Enter as the input.
		const input = document.createElement("input");
		input.type = "text";
		container.appendChild(input);
		input.focus();
		dispatchKey(input, "Enter");
		expect(onRowClick).not.toHaveBeenCalled();
	});

	it("upper-case `J` and `K` also work (case-insensitive)", () => {
		mountTable({});
		act(() => dispatchKey(getTableWrap(), "J"));
		act(() => dispatchKey(getTableWrap(), "J"));
		expect(focusedRowIndex()).toBe(2);
		act(() => dispatchKey(getTableWrap(), "K"));
		expect(focusedRowIndex()).toBe(1);
	});
});
