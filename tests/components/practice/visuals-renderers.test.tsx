/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { NumberLine } from "@/components/student/practice/visuals/renderers/number-line";
import type { NumberLineSpec } from "@/lib/practice/visuals/types";

describe("<NumberLine />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	function render(spec: NumberLineSpec) {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<NumberLine spec={spec} />);
		});
	}

	it("renders an SVG with tick marks for valid inputs", () => {
		render({
			kind: "number_line",
			min: 0,
			max: 5,
			tickStep: 1,
			points: [{ value: 3, label: "x", openCircle: false }],
			intervals: [],
		});
		const svg = container.querySelector("svg");
		expect(svg).not.toBeNull();
		// 6 tick marks for 0,1,2,3,4,5 plus interval/point circles.
		expect(svg!.querySelectorAll("text").length).toBeGreaterThanOrEqual(6);
	});

	it("renders an interval as a thick segment with two endpoint circles", () => {
		render({
			kind: "number_line",
			min: -2,
			max: 2,
			tickStep: 1,
			points: [],
			intervals: [
				{ from: -1, to: 1, leftOpen: true, rightOpen: false, label: "(-1, 1]" },
			],
		});
		const circles = container.querySelectorAll("circle");
		expect(circles.length).toBeGreaterThanOrEqual(2);
	});

	it("returns a friendly fallback for invalid range", () => {
		render({
			kind: "number_line",
			min: 5,
			max: 5,
			tickStep: 1,
			points: [],
			intervals: [],
		});
		expect(container.textContent ?? "").toContain("Invalid number-line range");
	});

	it("does not loop forever when tickStep is tiny relative to range", () => {
		render({
			kind: "number_line",
			min: 0,
			max: 1,
			tickStep: 0.0001, // would generate 10000 ticks unguarded; capped to 200
			points: [],
			intervals: [],
		});
		const ticks = container.querySelectorAll("text");
		expect(ticks.length).toBeLessThanOrEqual(220);
	});
});
