/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StepSubject } from "@/components/student/practice/practice-test-wizard/step-subject";

describe("StepSubject", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders all enrolled subjects and clusters", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<StepSubject
					enrolledSubjects={[
						{ id: "s1", name: "Physics", sort_order: 1, subject_group: null },
						{ id: "s2", name: "Chemistry", sort_order: 2, subject_group: null },
					]}
					subjectId={null}
					subjectProgressBySubjectId={{}}
					onPickSubject={() => {}}
				/>,
			);
		});

		expect(container.textContent).toContain("Choose a subject");
		expect(container.textContent).toContain("Physics");
		expect(container.textContent).toContain("Chemistry");
	});

	it("invokes onPickSubject when a subject button is clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onPickSubject = vi.fn();

		await act(async () => {
			root!.render(
				<StepSubject
					enrolledSubjects={[{ id: "s1", name: "Physics", sort_order: 1, subject_group: null }]}
					subjectId={null}
					subjectProgressBySubjectId={{}}
					onPickSubject={onPickSubject}
				/>,
			);
		});

		const button = Array.from(container.querySelectorAll("button")).find(
			(b) => b.textContent?.includes("Physics"),
		);
		expect(button).toBeTruthy();
		await act(async () => {
			button!.click();
		});
		expect(onPickSubject).toHaveBeenCalledWith("s1");
	});
});
