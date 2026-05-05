/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExitConfirmDialog } from "@/components/student/practice/practice-test-session/exit-confirm-dialog";

describe("ExitConfirmDialog", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the leave-session prompt when open", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<ExitConfirmDialog
					open
					onOpenChange={() => {}}
					unsyncedCount={0}
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Leave practice session?");
		expect(document.body.textContent).toContain("All your answers are saved");
	});

	it("warns about unsynced answers when count > 0", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<ExitConfirmDialog
					open
					onOpenChange={() => {}}
					unsyncedCount={3}
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("3");
		expect(document.body.textContent).toContain("unsynced");
	});

	it("calls onConfirm when the Leave button is clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onConfirm = vi.fn();

		await act(async () => {
			root!.render(
				<ExitConfirmDialog
					open
					onOpenChange={() => {}}
					unsyncedCount={0}
					onCancel={() => {}}
					onConfirm={onConfirm}
				/>,
			);
		});

		const leaveButton = Array.from(document.body.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === "Leave",
		);
		expect(leaveButton).toBeTruthy();

		await act(async () => {
			leaveButton!.click();
		});
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("does not render when closed", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<ExitConfirmDialog
					open={false}
					onOpenChange={() => {}}
					unsyncedCount={0}
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).not.toContain("Leave practice session?");
	});
});
