/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { NumberLine } from "@/components/student/practice/visuals/renderers/number-line";
import { PhysicsDiagram } from "@/components/student/practice/visuals/renderers/physics-diagram";
import { ChemistryReaction } from "@/components/student/practice/visuals/renderers/chemistry-reaction";
import { AccountancyTable } from "@/components/student/practice/visuals/renderers/accountancy-table";
import { __test as accountancyTest } from "@/components/student/practice/visuals/renderers/accountancy-table";
import { __test as economicsTest } from "@/components/student/practice/visuals/renderers/economics-curve";
import type {
	NumberLineSpec,
	PhysicsDiagramSpec,
	ChemistryReactionSpec,
	AccountancyTableSpec,
} from "@/lib/practice/visuals/types";

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

describe("<PhysicsDiagram /> — free body", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders one arrow per force", () => {
		const spec: PhysicsDiagramSpec = {
			kind: "physics_diagram",
			subKind: "free_body",
			bodyLabel: "Block",
			forces: [
				{ name: "W", magnitude: 49, angleDeg: 270 },
				{ name: "N", magnitude: 42, angleDeg: 60 },
			],
			inclineDeg: 30,
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<PhysicsDiagram spec={spec} />);
		});
		const lines = container.querySelectorAll("line");
		// 1 incline line + 2 force arrows = 3 lines minimum.
		expect(lines.length).toBeGreaterThanOrEqual(3);
		expect(container.textContent).toContain("Block");
		expect(container.textContent).toContain("W");
		expect(container.textContent).toContain("N");
	});
});

describe("<PhysicsDiagram /> — circuit", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders nodes and components", () => {
		const spec: PhysicsDiagramSpec = {
			kind: "physics_diagram",
			subKind: "circuit",
			nodes: [
				{ id: "a", x: 0, y: 0 },
				{ id: "b", x: 4, y: 0 },
				{ id: "c", x: 4, y: 3 },
				{ id: "d", x: 0, y: 3 },
			],
			components: [
				{
					type: "battery",
					from: "a",
					to: "b",
					emfVolts: 9,
					label: "9V",
				},
				{ type: "resistor", from: "b", to: "c", resistanceOhms: 100, label: "R" },
				{ type: "wire", from: "c", to: "d" },
				{ type: "wire", from: "d", to: "a" },
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<PhysicsDiagram spec={spec} />);
		});
		expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(4);
		expect(container.querySelectorAll("line").length).toBeGreaterThanOrEqual(4);
	});
});

describe("<ChemistryReaction />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders KaTeX HTML for a valid mhchem string", () => {
		const spec: ChemistryReactionSpec = {
			kind: "chemistry_reaction",
			ce: "H2O + CO2 -> H2CO3",
			label: "Carbonic acid formation",
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<ChemistryReaction spec={spec} />);
		});
		expect(container.querySelector(".katex")).not.toBeNull();
		expect(container.textContent).toContain("Carbonic acid formation");
	});

	it("falls back gracefully on a syntactically broken mhchem string", () => {
		const spec: ChemistryReactionSpec = {
			kind: "chemistry_reaction",
			ce: "\\garbage{",
			label: null,
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<ChemistryReaction spec={spec} />);
		});
		expect(container.textContent ?? "").toContain("Could not render reaction");
	});
});

describe("<AccountancyTable />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders journal entry rows with formatted Indian rupees", () => {
		const spec: AccountancyTableSpec = {
			kind: "accountancy_table",
			subKind: "journal_entry",
			rows: [
				{
					date: "2026-04-01",
					particulars: "Furniture A/c           Dr.",
					debit: 100000,
					credit: null,
					narration: null,
				},
				{
					date: "",
					particulars: "    To Cash A/c",
					debit: null,
					credit: 100000,
					narration: "(Being furniture purchased for cash)",
				},
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<AccountancyTable spec={spec} />);
		});
		expect(container.textContent).toContain("Furniture A/c");
		expect(container.textContent).toContain("₹1,00,000"); // one lakh in Indian numbering
	});

	it("computes trial balance totals", () => {
		const spec: AccountancyTableSpec = {
			kind: "accountancy_table",
			subKind: "trial_balance",
			rows: [
				{ particulars: "Cash", debit: 50000, credit: null },
				{ particulars: "Capital", debit: null, credit: 50000 },
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<AccountancyTable spec={spec} />);
		});
		const txt = container.textContent ?? "";
		expect(txt).toContain("Total");
		expect(txt).toContain("₹50,000");
	});
});

describe("Indian-numbering rupee formatter", () => {
	it("groups one lakh as 1,00,000", () => {
		expect(accountancyTest.formatIndianNumber(100000)).toBe("1,00,000");
	});
	it("groups ten lakh as 10,00,000", () => {
		expect(accountancyTest.formatIndianNumber(1000000)).toBe("10,00,000");
	});
	it("groups one crore as 1,00,00,000", () => {
		expect(accountancyTest.formatIndianNumber(10000000)).toBe("1,00,00,000");
	});
	it("renders null as empty string", () => {
		expect(accountancyTest.formatRupee(null)).toBe("");
	});
	it("brackets negative amounts per accounting convention", () => {
		expect(accountancyTest.formatRupee(-15000)).toBe("(₹15,000)");
	});
});

describe("economics curve p→x substitution", () => {
	it("replaces standalone p with x", () => {
		expect(economicsTest.substitutePForX("80 - 0.4 * p")).toBe("80 - 0.4 * x");
	});
	it("does not touch identifiers that contain p", () => {
		expect(economicsTest.substitutePForX("exp(p) + pi")).toBe("exp(x) + pi");
	});
	it("handles p at the very start", () => {
		expect(economicsTest.substitutePForX("p^2 + 1")).toBe("x^2 + 1");
	});
});
