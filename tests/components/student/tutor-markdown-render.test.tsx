/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { TutorMarkdown } from "@/components/student/doubt/tutor-markdown";

// Tell React this is an act() environment so renders/effects flush synchronously.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(markdown: string): Promise<HTMLElement> {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root: Root = createRoot(container);
	await act(async () => {
		root.render(<TutorMarkdown>{markdown}</TutorMarkdown>);
	});
	roots.push(root);
	return container;
}

const roots: Root[] = [];
afterEach(() => {
	act(() => {
		for (const r of roots) r.unmount();
	});
	roots.length = 0;
	document.body.replaceChildren();
});

describe("TutorMarkdown rendering", () => {
	it("typesets inline math written with $...$", async () => {
		const c = await render("The speed is $v = u + at$ today.");
		expect(c.querySelector(".katex")).not.toBeNull();
	});

	it("typesets the LaTeX bracket forms \\(...\\) and \\[...\\] (normalized)", async () => {
		const inline = await render("Here \\(E = mc^2\\) is mass-energy.");
		expect(inline.querySelector(".katex")).not.toBeNull();
		// And the literal backslash-paren must NOT survive as text.
		expect(inline.textContent ?? "").not.toContain("\\(");

		const display = await render("Result: \\[\\int_0^1 x^2\\,dx = \\tfrac{1}{3}\\]");
		expect(display.querySelector(".katex-display")).not.toBeNull();
	});

	it("renders chemistry via mhchem (\\ce) without a KaTeX error", async () => {
		const c = await render("Water forms: $\\ce{2H2 + O2 -> 2H2O}$.");
		expect(c.querySelector(".katex")).not.toBeNull();
		// mhchem is loaded, so \ce must resolve — no error node.
		expect(c.querySelector(".katex-error")).toBeNull();
	});

	it("normalizes Unicode math in prose into KaTeX", async () => {
		const c = await render("The area works out to 5 cm² overall.");
		expect(c.querySelector(".katex")).not.toBeNull();
	});

	it("renders Markdown structure: headings, lists, bold, tables", async () => {
		const md = [
			"## Key idea",
			"",
			"The **mitochondrion** is the powerhouse.",
			"",
			"- first point",
			"- second point",
			"",
			"| A | B |",
			"| - | - |",
			"| 1 | 2 |",
		].join("\n");
		const c = await render(md);
		// h2 is mapped to <h4> by the component's renderer overrides.
		expect(c.querySelector("h4")?.textContent).toContain("Key idea");
		expect(c.querySelector("strong")?.textContent).toContain("mitochondrion");
		expect(c.querySelectorAll("li").length).toBe(2);
		expect(c.querySelector("table")).not.toBeNull();
		expect(c.querySelectorAll("td").length).toBe(2);
	});

	it("does not typeset math inside a fenced code block", async () => {
		const c = await render("```\nliteral \\(x\\) stays\n```");
		expect(c.querySelector("code")).not.toBeNull();
		expect(c.querySelector(".katex")).toBeNull();
		expect(c.textContent ?? "").toContain("\\(x\\)");
	});
});
