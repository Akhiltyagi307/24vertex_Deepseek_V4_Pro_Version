/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
	TutorMarkdown,
	splitSolutionSteps,
} from "@/components/student/doubt/tutor-markdown";

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

	it("renders a full walkthrough as a <details> disclosure, first step open", async () => {
		const md = [
			"Here is the full solution.",
			"",
			"### Step 1: Write the formula",
			"",
			"We use $v = u + at$.",
			"",
			"### Step 2: Substitute",
			"",
			"Plug in the values.",
			"",
			"### Step 3: Solve",
			"",
			"The answer is 20 m/s.",
		].join("\n");
		const c = await render(md);
		const details = c.querySelectorAll("details");
		expect(details.length).toBe(3);
		// First step open, the rest collapsed.
		expect(details[0]?.hasAttribute("open")).toBe(true);
		expect(details[1]?.hasAttribute("open")).toBe(false);
		expect(details[2]?.hasAttribute("open")).toBe(false);
		// Summary carries the step heading text.
		expect(c.querySelector("summary")?.textContent).toContain("Step 1: Write the formula");
		// Math inside a step still typesets — content is not garbled.
		expect(c.querySelector(".katex")).not.toBeNull();
		// The preamble survives outside the disclosure.
		expect(c.textContent ?? "").toContain("Here is the full solution.");
	});

	it("falls back to plain markdown with only one Step heading", async () => {
		const c = await render("### Step 1: Just one\n\nNo disclosure here.");
		expect(c.querySelector("details")).toBeNull();
		// The lone heading renders as a normal heading (### → h5 via overrides).
		expect(c.querySelector("h5")?.textContent).toContain("Step 1: Just one");
	});

	it("never splits on a '### Step' that lives inside a code fence", async () => {
		const c = await render("```\n### Step 1: fake\n### Step 2: fake\n```");
		expect(c.querySelector("details")).toBeNull();
		expect(c.querySelector("code")).not.toBeNull();
		expect(c.textContent ?? "").toContain("### Step 1: fake");
	});
});

describe("splitSolutionSteps", () => {
	it("returns no steps for ordinary prose (fallback to plain rendering)", () => {
		const out = splitSolutionSteps("Just a short hint. Try the setup first.");
		expect(out.steps).toHaveLength(0);
		expect(out.preamble).toContain("short hint");
	});

	it("splits two-or-more Step headings and preserves bodies verbatim", () => {
		const md = "intro\n\n### Step 1: A\n\nbody one\n\n### Step 2: B\n\nbody two";
		const out = splitSolutionSteps(md);
		expect(out.preamble).toBe("intro");
		expect(out.steps).toHaveLength(2);
		expect(out.steps[0]).toEqual({ heading: "Step 1: A", body: "body one" });
		expect(out.steps[1]).toEqual({ heading: "Step 2: B", body: "body two" });
	});

	it("ignores Step headings inside a fenced code block", () => {
		const md = "```\n### Step 1: x\n### Step 2: y\n```";
		expect(splitSolutionSteps(md).steps).toHaveLength(0);
	});
});
