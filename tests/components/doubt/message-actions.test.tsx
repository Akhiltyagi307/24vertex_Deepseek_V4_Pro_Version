/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	MessageActions,
	TypingIndicator,
} from "@/components/student/doubt/doubt-chat-view/message-actions";

describe("MessageActions / TypingIndicator", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the copy trigger with an aria-label", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<MessageActions text="hello" />);
		});

		const button = container.querySelector("button");
		expect(button).toBeTruthy();
		expect(button?.getAttribute("aria-label")).toBe("Copy message");
	});

	it("renders the typing indicator with role=status", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<TypingIndicator />);
		});

		const status = container.querySelector('[role="status"]');
		expect(status).toBeTruthy();
		expect(status?.getAttribute("aria-label")).toBe("Tutor is thinking");
	});

	it("renders the similar-problem chip when canRequestSimilar is true", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onRequestSimilar = vi.fn();
		await act(async () => {
			root!.render(
				<MessageActions
					text="A long enough text — at least 40 characters of solved problem content."
					canRequestSimilar
					onRequestSimilar={onRequestSimilar}
				/>,
			);
		});

		const button = Array.from(container.querySelectorAll("button")).find(
			(b) => b.getAttribute("aria-label") === "Give me a similar problem",
		);
		expect(button).toBeTruthy();
		await act(async () => {
			button!.click();
		});
		expect(onRequestSimilar).toHaveBeenCalledTimes(1);
	});

	it("does not render the similar-problem chip without the flag", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(<MessageActions text="hello" />);
		});

		const button = Array.from(container.querySelectorAll("button")).find(
			(b) => b.getAttribute("aria-label") === "Give me a similar problem",
		);
		expect(button).toBeUndefined();
	});
});
