/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { WizardSummaryCard } from "@/components/student/practice/practice-test-wizard/wizard-summary-card";

describe("WizardSummaryCard", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders configuration summary with topic count", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<WizardSummaryCard
					title="Ready to generate"
					description="Saved your choices"
					subjectName="Physics"
					topicNames={["Mechanics", "Optics"]}
					difficultyLabel="Medium"
					durationLabel="60 min"
				/>,
			);
		});

		expect(container.textContent).toContain("Ready to generate");
		expect(container.textContent).toContain("Physics");
		expect(container.textContent).toContain("Mechanics");
		expect(container.textContent).toContain("Optics");
		expect(container.textContent).toContain("Topics (2)");
		expect(container.textContent).toContain("Medium");
		expect(container.textContent).toContain("60 min");
	});

	it("falls back to em-dash when subjectName is null", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<WizardSummaryCard
					title="t"
					description="d"
					subjectName={null}
					topicNames={[]}
					difficultyLabel="Easy"
					durationLabel="—"
				/>,
			);
		});

		expect(container.textContent).toContain("Topics (0)");
	});
});
