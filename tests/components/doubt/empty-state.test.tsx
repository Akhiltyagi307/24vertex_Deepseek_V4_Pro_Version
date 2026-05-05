/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/student/doubt/doubt-chat-view/empty-state";

describe("EmptyState", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the topic-specific welcome heading", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<EmptyState topicName="Optics" onPick={() => {}} />);
		});

		expect(container.textContent).toContain("Let's unpack Optics");
	});

	it("falls back to a generic heading when topicName is null", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<EmptyState topicName={null} onPick={() => {}} />);
		});

		expect(container.textContent).toContain("Let's unpack this topic together");
	});

	it("invokes onPick with the suggested prompt when clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onPick = vi.fn();

		await act(async () => {
			root!.render(<EmptyState topicName="Optics" onPick={onPick} />);
		});

		const button = Array.from(container.querySelectorAll("button")).find(
			(b) => b.textContent === "Give me a 3-line summary",
		);
		expect(button).toBeTruthy();
		await act(async () => {
			button!.click();
		});
		expect(onPick).toHaveBeenCalledWith("Give me a 3-line summary");
	});
});
