/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportQuestionDialog } from "@/components/student/practice/practice-test-session/report-question-dialog";

describe("ReportQuestionDialog", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the report-question prompt and textarea", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<ReportQuestionDialog
					open
					onOpenChange={() => {}}
					reportReason=""
					onReportReasonChange={() => {}}
					reportSubmitting={false}
					flagNotice={null}
					canSubmit={false}
					onSubmit={() => {}}
					onCancel={() => {}}
				/>,
			);
		});

		expect(document.body.textContent).toContain("Report this question");
		expect(document.body.querySelector("textarea")).toBeTruthy();
	});

	it("disables submit when canSubmit is false", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<ReportQuestionDialog
					open
					onOpenChange={() => {}}
					reportReason=""
					onReportReasonChange={() => {}}
					reportSubmitting={false}
					flagNotice={null}
					canSubmit={false}
					onSubmit={() => {}}
					onCancel={() => {}}
				/>,
			);
		});

		const submit = Array.from(document.body.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === "Submit",
		) as HTMLButtonElement | undefined;
		expect(submit).toBeTruthy();
		expect(submit!.disabled).toBe(true);
	});

	it("calls onSubmit when canSubmit is true and Submit is clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onSubmit = vi.fn();

		await act(async () => {
			root!.render(
				<ReportQuestionDialog
					open
					onOpenChange={() => {}}
					reportReason="The question is unclear."
					onReportReasonChange={() => {}}
					reportSubmitting={false}
					flagNotice={null}
					canSubmit
					onSubmit={onSubmit}
					onCancel={() => {}}
				/>,
			);
		});

		const submit = Array.from(document.body.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === "Submit",
		) as HTMLButtonElement | undefined;
		expect(submit).toBeTruthy();
		await act(async () => {
			submit!.click();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
