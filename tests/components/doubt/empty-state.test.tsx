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

	it("renders the topic-specific welcome heading (explain)", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<EmptyState topicName="Optics" chapterName={null} tutorMode="explain" onPick={() => {}} />,
			);
		});

		expect(container.textContent).toContain("Let's unpack Optics");
	});

	it("falls back to a generic heading when topicName is null", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<EmptyState topicName={null} chapterName={null} tutorMode="explain" onPick={() => {}} />,
			);
		});

		expect(container.textContent).toContain("Let's unpack this chapter");
	});

	it("shows mode-specific headline and prompts for solve_with_me", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<EmptyState
					topicName="Trigonometry"
					chapterName={null}
					tutorMode="solve_with_me"
					onPick={() => {}}
				/>,
			);
		});

		expect(container.textContent).toContain("Solve a problem on Trigonometry");
		expect(container.textContent).toContain("I have a problem to work through");
		// Explain-mode starter must not leak into solve mode.
		expect(container.textContent).not.toContain("Give me a 3-line summary");
	});

	it("shows quiz-specific headline and prompts for quiz_me", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<EmptyState topicName="Optics" chapterName={null} tutorMode="quiz_me" onPick={() => {}} />,
			);
		});

		expect(container.textContent).toContain("Quiz yourself on Optics");
		expect(container.textContent).toContain("Quiz me — 5 questions");
	});

	it("invokes onPick with the suggested prompt when clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onPick = vi.fn();

		await act(async () => {
			root!.render(
				<EmptyState topicName="Optics" chapterName={null} tutorMode="explain" onPick={onPick} />,
			);
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
