/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StepConfig } from "@/components/student/practice/practice-test-wizard/step-config";

describe("StepConfig", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders the difficulty + time options", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root!.render(
				<StepConfig
					difficulty="medium"
					durationSeconds={3600}
					subjectName="Physics"
					onPickDifficulty={() => {}}
					onPickDurationSeconds={() => {}}
				/>,
			);
		});

		expect(container.textContent).toContain("Difficulty");
		expect(container.textContent).toContain("Easy");
		expect(container.textContent).toContain("Medium");
		expect(container.textContent).toContain("Hard");
		expect(container.textContent).toContain("Time limit");
		expect(container.textContent).toContain("Question mix");
	});

	it("calls onPickDifficulty when an option is selected", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onPickDifficulty = vi.fn();

		await act(async () => {
			root!.render(
				<StepConfig
					difficulty="medium"
					durationSeconds={3600}
					subjectName="Physics"
					onPickDifficulty={onPickDifficulty}
					onPickDurationSeconds={() => {}}
				/>,
			);
		});

		const easyRadio = container.querySelector<HTMLInputElement>('input[id="diff-easy"]');
		expect(easyRadio).toBeTruthy();
		await act(async () => {
			easyRadio!.click();
		});
		expect(onPickDifficulty).toHaveBeenCalledWith("easy");
	});
});
