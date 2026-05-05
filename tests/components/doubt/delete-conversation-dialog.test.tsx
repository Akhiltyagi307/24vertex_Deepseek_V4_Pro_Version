/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteConversationDialog } from "@/components/student/doubt/doubt-chat-view/delete-conversation-dialog";

describe("DeleteConversationDialog", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the headline and confirm/cancel buttons when open", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<DeleteConversationDialog
					open
					onOpenChange={() => {}}
					deleteHeadline="Photosynthesis"
					deleteInProgress={false}
					canDelete
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Delete this chat?");
		expect(document.body.textContent).toContain("Photosynthesis");
		expect(document.body.textContent).toContain("Cancel");
		expect(document.body.textContent).toContain("Delete chat");
	});

	it("calls onConfirm when the destructive button is clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onConfirm = vi.fn();

		await act(async () => {
			root!.render(
				<DeleteConversationDialog
					open
					onOpenChange={() => {}}
					deleteHeadline="Test chat"
					deleteInProgress={false}
					canDelete
					onCancel={() => {}}
					onConfirm={onConfirm}
				/>,
			);
		});

		const buttons = Array.from(document.body.querySelectorAll("button"));
		const deleteBtn = buttons.find((b) => b.textContent?.includes("Delete chat"));
		expect(deleteBtn).toBeTruthy();
		await act(async () => {
			deleteBtn!.click();
		});
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("shows a Deleting… label when deleteInProgress is true", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<DeleteConversationDialog
					open
					onOpenChange={() => {}}
					deleteHeadline="X"
					deleteInProgress
					canDelete
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Deleting…");
	});
});
