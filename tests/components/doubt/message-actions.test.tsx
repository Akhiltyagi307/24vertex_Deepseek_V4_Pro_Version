/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

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
});
