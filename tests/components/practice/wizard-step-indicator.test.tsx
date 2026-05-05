/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { WizardStepIndicator } from "@/components/student/practice/practice-test-wizard/wizard-step-indicator";

describe("WizardStepIndicator", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the step counter and accessible label", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const labels = ["Subject", "Topics", "Difficulty", "Review"];

		await act(async () => {
			root!.render(<WizardStepIndicator step={1} labels={labels} />);
		});

		expect(container.textContent).toContain("Step");
		expect(container.textContent).toContain("2");
		expect(container.textContent).toContain("of 4");
		const nav = container.querySelector("nav");
		expect(nav?.getAttribute("aria-label")).toContain("Topics");
	});
});
