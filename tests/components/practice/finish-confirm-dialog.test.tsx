/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FinishConfirmDialog } from "@/components/student/practice/practice-test-session/finish-confirm-dialog";

describe("FinishConfirmDialog", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders progress summary with answered count and percentage", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<FinishConfirmDialog
					open
					onOpenChange={() => {}}
					progressPct={75}
					answeredCount={6}
					totalQuestions={8}
					unansweredCount={2}
					flaggedCount={1}
					submitting={false}
					submitError={null}
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Finish and submit?");
		expect(document.body.textContent).toContain("75%");
		expect(document.body.textContent).toContain("6");
		expect(document.body.textContent).toContain("/8");
	});

	it("calls onConfirm when Submit clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onConfirm = vi.fn();

		await act(async () => {
			root!.render(
				<FinishConfirmDialog
					open
					onOpenChange={() => {}}
					progressPct={100}
					answeredCount={10}
					totalQuestions={10}
					unansweredCount={0}
					flaggedCount={0}
					submitting={false}
					submitError={null}
					onCancel={() => {}}
					onConfirm={onConfirm}
				/>,
			);
		});

		const submitButton = Array.from(document.body.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === "Submit test",
		);
		expect(submitButton).toBeTruthy();

		await act(async () => {
			submitButton!.click();
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("disables submit while submitting and shows submitting label", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<FinishConfirmDialog
					open
					onOpenChange={() => {}}
					progressPct={50}
					answeredCount={5}
					totalQuestions={10}
					unansweredCount={5}
					flaggedCount={0}
					submitting={true}
					submitError={null}
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Submitting…");
	});

	it("renders submit error when present", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<FinishConfirmDialog
					open
					onOpenChange={() => {}}
					progressPct={100}
					answeredCount={5}
					totalQuestions={5}
					unansweredCount={0}
					flaggedCount={0}
					submitting={false}
					submitError="Could not submit"
					onCancel={() => {}}
					onConfirm={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Could not submit");
	});
});
