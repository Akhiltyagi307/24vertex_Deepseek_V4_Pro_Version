/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShortcutsDialog } from "@/components/student/practice/practice-test-session/shortcuts-dialog";

describe("ShortcutsDialog", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders shortcut entries when open", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<ShortcutsDialog open onOpenChange={() => {}} />);
		});

		expect(document.body.textContent).toContain("Keyboard shortcuts");
		expect(document.body.textContent).toContain("Next question");
		expect(document.body.textContent).toContain("Previous question");
		expect(document.body.textContent).toContain("Flag / unflag for review");
	});

	it("closes via Close button by calling onOpenChange(false)", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onOpenChange = vi.fn();

		await act(async () => {
			root!.render(<ShortcutsDialog open onOpenChange={onOpenChange} />);
		});

		const closeBtn = Array.from(document.body.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === "Close",
		);
		expect(closeBtn).toBeTruthy();

		await act(async () => {
			closeBtn!.click();
		});

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
