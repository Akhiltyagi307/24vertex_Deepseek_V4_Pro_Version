/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

import { SensitiveLinkCode } from "@/components/teacher/sensitive-link-code";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	Object.assign(navigator, {
		clipboard: { writeText: vi.fn(async () => undefined) },
	});
});

afterEach(() => {
	act(() => root.unmount());
	if (container.parentNode) container.parentNode.removeChild(container);
});

function render(code: string | null) {
	act(() => {
		root.render(<SensitiveLinkCode code={code} />);
	});
}

function getButton(label: RegExp): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll("button")).find((b) =>
		label.test(b.getAttribute("aria-label") ?? b.textContent ?? ""),
	);
	if (!button) throw new Error(`button not found: ${label}`);
	return button;
}

describe("SensitiveLinkCode", () => {
	it("masks link codes until the teacher explicitly reveals them", () => {
		render("AB1234");

		expect(container.textContent).toContain("••••••");
		expect(container.textContent).not.toContain("AB1234");

		act(() => {
			getButton(/show/i).click();
		});

		expect(container.textContent).toContain("AB1234");
		expect(getButton(/hide/i)).toBeTruthy();
	});

	it("copies the full code without requiring reveal", async () => {
		render("AB1234");

		await act(async () => {
			getButton(/copy/i).click();
		});

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith("AB1234");
		expect(container.textContent).toContain("Copied");
	});

	it("renders an empty marker without action buttons when the code is missing", () => {
		render(null);

		expect(container.textContent).toContain("—");
		expect(container.querySelector("button")).toBeNull();
	});
});

