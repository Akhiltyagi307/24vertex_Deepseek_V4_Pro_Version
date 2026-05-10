/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { QuestionVisual } from "@/components/student/practice/visuals/question-visual";
import { VISUAL_EXEMPLARS } from "@/lib/practice/visuals/exemplars";

describe("QuestionVisual dispatcher", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders nothing when visual is null", () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<QuestionVisual visual={null} />);
		});
		expect(container.querySelector("[data-question-visual]")).toBeNull();
	});

	it("renders a figure shell with caption and aria-label when visual is non-null", () => {
		const exemplar = VISUAL_EXEMPLARS.find((ex) => ex.visual !== null);
		expect(exemplar?.visual).toBeTruthy();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<QuestionVisual visual={exemplar!.visual} />);
		});
		const figure = container.querySelector("[data-question-visual]");
		expect(figure).not.toBeNull();
		expect(figure?.getAttribute("aria-label")).toBe(exemplar!.visual!.altText);
		expect(figure?.querySelector("figcaption")?.textContent).toBe(
			exemplar!.visual!.caption,
		);
		expect(figure?.getAttribute("data-question-visual-kind")).toBe(
			exemplar!.visual!.spec.kind,
		);
	});

	it("renders a fallback message when the spec's kind has no renderer registered", () => {
		// Pick an exemplar whose kind hasn't been wired yet in this commit.
		// Update or drop this case as renderers ship in subsequent commits.
		const unsupportedExemplar = VISUAL_EXEMPLARS.find(
			(ex) => ex.visual?.spec.kind === "english_passage",
		);
		expect(unsupportedExemplar?.visual).toBeTruthy();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<QuestionVisual visual={unsupportedExemplar!.visual} />);
		});
		const figure = container.querySelector("[data-question-visual]");
		expect(figure?.textContent ?? "").toContain("not yet supported");
	});
});
