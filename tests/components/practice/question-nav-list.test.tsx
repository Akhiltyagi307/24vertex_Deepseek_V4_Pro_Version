/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionNavList } from "@/components/student/practice/practice-test-session/question-nav-list";
import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";

function buildQuestion(overrides: Partial<PracticeSessionQuestion> = {}): PracticeSessionQuestion {
	return {
		id: "q1",
		question_number: 1,
		question_text: "What is 2+2?",
		question_type: "multiple_choice",
		difficulty_level: "easy",
		options: { A: "3", B: "4" },
		topic_id: "t1",
		topic_name: "Arithmetic",
		chapter_name: null,
		visual: null,
		...overrides,
	};
}

describe("QuestionNavList", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders question numbers and labels", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const sorted = [
			buildQuestion({ id: "q1", question_number: 1 }),
			buildQuestion({ id: "q2", question_number: 2, question_type: "fill_in_blank", options: null }),
		];

		await act(async () => {
			root!.render(
				<QuestionNavList
					sorted={sorted}
					activeId="q1"
					answers={{}}
					flagged={{}}
					skipped={{}}
					onPickIndex={() => {}}
				/>,
			);
		});

		expect(container.textContent).toContain("1");
		expect(container.textContent).toContain("2");
	});

	it("invokes onPickIndex when a question is clicked", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const onPickIndex = vi.fn();
		const sorted = [
			buildQuestion({ id: "q1", question_number: 1 }),
			buildQuestion({ id: "q2", question_number: 2 }),
		];

		await act(async () => {
			root!.render(
				<QuestionNavList
					sorted={sorted}
					activeId="q1"
					answers={{}}
					flagged={{}}
					skipped={{}}
					onPickIndex={onPickIndex}
				/>,
			);
		});

		const buttons = container.querySelectorAll("button");
		expect(buttons.length).toBe(2);
		await act(async () => {
			(buttons[1] as HTMLButtonElement).click();
		});
		expect(onPickIndex).toHaveBeenCalledWith(1);
	});

	it("shows answered checkmark when isAnswered() is true", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const sorted = [buildQuestion({ id: "q1", question_number: 1 })];

		await act(async () => {
			root!.render(
				<QuestionNavList
					sorted={sorted}
					activeId="q1"
					answers={{ q1: { kind: "mcq", value: "A" } }}
					flagged={{}}
					skipped={{}}
					onPickIndex={() => {}}
				/>,
			);
		});

		// The check icon is rendered inside the answered button
		expect(container.querySelector("svg")).toBeTruthy();
	});
});
