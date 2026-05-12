/** @vitest-environment jsdom */

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberLine } from "@/components/student/practice/visuals/renderers/number-line";
import { PhysicsDiagram } from "@/components/student/practice/visuals/renderers/physics-diagram";
import { ChemistryMolecule } from "@/components/student/practice/visuals/renderers/chemistry-molecule";
import { ChemistryReaction } from "@/components/student/practice/visuals/renderers/chemistry-reaction";
import { AccountancyTable } from "@/components/student/practice/visuals/renderers/accountancy-table";
import { __test as accountancyTest } from "@/components/student/practice/visuals/renderers/accountancy-table";
import { EconomicsCurve } from "@/components/student/practice/visuals/renderers/economics-curve";
import { __test as economicsTest } from "@/components/student/practice/visuals/renderers/economics-curve";
import { StatisticsChart } from "@/components/student/practice/visuals/renderers/statistics-chart";
import { DataTable } from "@/components/student/practice/visuals/renderers/data-table";
import { EnglishPassage } from "@/components/student/practice/visuals/renderers/english-passage";
import {
	BiologyDiagram,
	ChemistryCellDiagram,
	Flowchart,
	MapVisual,
	PhysicsFieldDiagram,
	PhysicsWaveDiagram,
	SourceExtract,
	Timeline,
} from "@/components/student/practice/visuals/renderers/template-renderers";
import type {
	NumberLineSpec,
	PhysicsDiagramSpec,
	ChemistryMoleculeSpec,
	ChemistryReactionSpec,
	AccountancyTableSpec,
	EconomicsCurveSpec,
	StatisticsChartSpec,
	DataTableSpec,
	EnglishPassageSpec,
	BiologyDiagramSpec,
	ChemistryCellDiagramSpec,
	FlowchartSpec,
	MapVisualSpec,
	PhysicsFieldDiagramSpec,
	PhysicsWaveDiagramSpec,
	SourceExtractSpec,
	TimelineSpec,
} from "@/lib/practice/visuals/types";

vi.mock("function-plot", () => ({
	default: vi.fn(() => undefined),
}));

vi.mock("smiles-drawer", () => ({
	default: {
		parse: (
			_smiles: string,
			onSuccess: (tree: object) => void,
			_onError?: (error: unknown) => void,
		) => onSuccess({}),
		SvgDrawer: class {
			draw(): void {}
		},
	},
}));

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

	it("renders axis label and minor ticks when configured", () => {
		render({
			kind: "number_line",
			min: 0,
			max: 4,
			tickStep: 1,
			minorTickStep: 0.5,
			axisLabel: "x (m)",
			points: [],
			intervals: [],
		});
		expect(container.textContent).toContain("x (m)");
		// Major + minor ticks should produce many line elements.
		expect(container.querySelectorAll("line").length).toBeGreaterThan(8);
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
				{ name: "W", magnitude: 49, angleDeg: 270, unit: "N", showMagnitude: true, componentArrows: false },
				{ name: "N", magnitude: 42, angleDeg: 60, unit: "N", showMagnitude: true, componentArrows: true },
			],
			inclineDeg: 30,
			inclineLabel: "30°",
			surfaceHatched: true,
			axisLegend: true,
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
		expect(container.textContent).toContain("W = 49 N");
		expect(container.textContent).toContain("N = 42 N");
		expect(container.textContent).toContain("+x");
		expect(container.textContent).toContain("+y");
	});
});

describe("<PhysicsDiagram /> — ray optics", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders axis unit, lens labels, and focal text", () => {
		const spec: PhysicsDiagramSpec = {
			kind: "physics_diagram",
			subKind: "ray_optics",
			axisMin: -30,
			axisMax: 30,
			axisUnit: "cm",
			axisTickStep: 10,
			axisMajorTickStep: 20,
			drawRays: true,
			objects: [
				{ kind: "object", x: -20, height: 5, dashed: false, label: "Object" },
				{ kind: "image", x: 15, height: -3, dashed: true, label: "Image" },
			],
			lenses: [{ type: "convex_lens", x: 0, focalLength: 10, label: "Convex lens" }],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<PhysicsDiagram spec={spec} />);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("x (cm)");
		expect(text).toContain("Convex lens");
		expect(text).toContain("f=10 cm");
		expect(text).toContain("u=-20 cm");
		expect(text).toContain("v=15 cm");
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
					label: null,
					polarityMarks: true,
					currentArrow: true,
				},
				{
					type: "resistor",
					from: "b",
					to: "c",
					resistanceOhms: 100,
					label: null,
					currentArrow: false,
				},
				{ type: "wire", from: "c", to: "d", currentArrow: true },
				{ type: "wire", from: "d", to: "a", currentArrow: false },
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
		const text = container.textContent ?? "";
		expect(text).toContain("9 V");
		expect(text).toContain("100 Ω");
		expect(text).toContain("+");
		expect(text).toContain("-");
	});
});

describe("template family renderers", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	function render(element: React.ReactElement) {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(element);
		});
	}

	it("renders biology diagrams with labels and notes", () => {
		const spec: BiologyDiagramSpec = {
			kind: "biology_diagram",
			subKind: "pedigree",
			title: "Pedigree for trait X",
			labels: [
				{ id: "i1", text: "I-1", x: 25, y: 25 },
				{ id: "i2", text: "I-2", x: 60, y: 25 },
			],
			notes: ["Shaded symbols show affected individuals."],
		};
		render(<BiologyDiagram spec={spec} />);
		expect(container.textContent).toContain("Pedigree for trait X");
		expect(container.textContent).toContain("I-1");
		expect(container.textContent).toContain("affected individuals");
	});

	it("renders process flowcharts", () => {
		const spec: FlowchartSpec = {
			kind: "flowchart",
			title: "Planning process",
			nodes: [
				{ id: "start", label: "Set objectives", detail: null, kind: "start" },
				{ id: "process", label: "Evaluate alternatives", detail: "Compare options", kind: "process" },
				{ id: "outcome", label: "Select plan", detail: null, kind: "outcome" },
			],
			edges: [
				{ from: "start", to: "process", label: null },
				{ from: "process", to: "outcome", label: "best fit" },
			],
		};
		render(<Flowchart spec={spec} />);
		expect(container.textContent).toContain("Planning process");
		expect(container.textContent).toContain("Evaluate alternatives");
		expect(container.textContent).toContain("best fit");
	});

	it("renders timeline and source extract stimuli", () => {
		const timeline: TimelineSpec = {
			kind: "timeline",
			title: "National movement events",
			axisLabel: "Chronology",
			events: [
				{ dateLabel: "1919", label: "Act passed", description: null, emphasis: false },
				{ dateLabel: "1930", label: "March begins", description: "Civil disobedience", emphasis: true },
			],
		};
		render(<Timeline spec={timeline} />);
		expect(container.textContent).toContain("National movement events");
		expect(container.textContent).toContain("1930");
		act(() => root?.unmount());
		document.body.replaceChildren();

		const source: SourceExtractSpec = {
			kind: "source_extract",
			title: "Case extract",
			source: "Sample source",
			context: "Read the source carefully.",
			lines: [{ number: 1, text: "Citizens participate through elections." }],
		};
		render(<SourceExtract spec={source} />);
		expect(container.textContent).toContain("Case extract");
		expect(container.textContent).toContain("Citizens participate");
	});

	it("renders map, chemistry cell, field, and wave visuals", () => {
		const map: MapVisualSpec = {
			kind: "map_visual",
			scope: "india",
			title: "Monsoon region",
			mapStyle: "thematic",
			regions: [{ id: "western-ghats", label: "Western Ghats", role: "highlight" }],
		};
		render(<MapVisual spec={map} />);
		expect(container.textContent).toContain("Monsoon region");
		expect(container.textContent).toContain("Western Ghats");
		act(() => root?.unmount());
		document.body.replaceChildren();

		const cell: ChemistryCellDiagramSpec = {
			kind: "chemistry_cell_diagram",
			cellType: "galvanic",
			anode: { label: "Anode", material: "Zn", electrolyte: "ZnSO4", polarity: "negative" },
			cathode: { label: "Cathode", material: "Cu", electrolyte: "CuSO4", polarity: "positive" },
			saltBridge: "KNO3",
			electronFlow: "anode_to_cathode",
			labels: ["Salt bridge"],
		};
		render(<ChemistryCellDiagram spec={cell} />);
		expect(container.textContent).toContain("Zn");
		expect(container.textContent).toContain("CuSO4");
		act(() => root?.unmount());
		document.body.replaceChildren();

		const field: PhysicsFieldDiagramSpec = {
			kind: "physics_field_diagram",
			fieldType: "electric",
			title: "Field between charges",
			sources: [
				{ label: "+Q", kind: "positive_charge", x: 25, y: 50 },
				{ label: "-Q", kind: "negative_charge", x: 75, y: 50 },
			],
			fieldLineCount: 6,
			labels: [{ id: "e", text: "E", x: 50, y: 30 }],
		};
		render(<PhysicsFieldDiagram spec={field} />);
		expect(container.textContent).toContain("Field between charges");
		expect(container.textContent).toContain("+Q");
		act(() => root?.unmount());
		document.body.replaceChildren();

		const wave: PhysicsWaveDiagramSpec = {
			kind: "physics_wave_diagram",
			waveType: "standing",
			title: "Standing wave",
			xMin: 0,
			xMax: 10,
			amplitude: 2,
			wavelength: 5,
			markers: [{ x: 2.5, label: "Antinode" }],
		};
		render(<PhysicsWaveDiagram spec={wave} />);
		expect(container.textContent).toContain("Standing wave");
		expect(container.textContent).toContain("Antinode");
	});
});

describe("<ChemistryMolecule />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders molecule label below drawing", async () => {
		const spec: ChemistryMoleculeSpec = {
			kind: "chemistry_molecule",
			smiles: "C",
			display: "2d",
			label: "Methane",
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		await act(async () => {
			root!.render(<ChemistryMolecule spec={spec} />);
		});
		expect(container.textContent).toContain("Methane");
		expect(container.querySelector("svg")).not.toBeNull();
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

describe("<EconomicsCurve />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders point-mark callout labels", async () => {
		const spec: EconomicsCurveSpec = {
			kind: "economics_curve",
			xLabel: "Q",
			yLabel: "P",
			xMin: 0,
			xMax: 100,
			yMin: 0,
			yMax: 100,
			curves: [{ expr: "80 - 0.5 * p", color: "primary", label: "Demand" }],
			marks: [{ x: 40, y: 60, label: "E*", kind: "point" }],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		await act(async () => {
			root!.render(<EconomicsCurve spec={spec} />);
		});
		expect(container.textContent).toContain("E*");
	});
});

describe("<StatisticsChart />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders bar value labels and line legend", () => {
		const spec: StatisticsChartSpec = {
			kind: "statistics_chart",
			subKind: "bar",
			xLabel: "Category",
			yLabel: "Count",
			data: [
				{ label: "A", value: 91 },
				{ label: "B", value: 73 },
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<StatisticsChart spec={spec} />);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("91");
		expect(text).toContain("73");
	});

	it("renders line-series legend labels", () => {
		const spec: StatisticsChartSpec = {
			kind: "statistics_chart",
			subKind: "line",
			xLabel: "Time",
			yLabel: "Value",
			series: [
				{
					name: "Series 1",
					points: [
						{ x: 1, y: 2 },
						{ x: 2, y: 4 },
					],
				},
				{
					name: "Series 2",
					points: [
						{ x: 1, y: 3 },
						{ x: 2, y: 5 },
					],
				},
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<StatisticsChart spec={spec} />);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("Series 1");
		expect(text).toContain("Series 2");
	});

	it("renders percentage labels on pie slices", () => {
		const spec: StatisticsChartSpec = {
			kind: "statistics_chart",
			subKind: "pie",
			slices: [
				{ label: "A", value: 30 },
				{ label: "B", value: 70 },
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<StatisticsChart spec={spec} />);
		});
		const text = container.textContent ?? "";
		expect(text).toContain("A (30%)");
		expect(text).toContain("B (70%)");
	});
});

describe("<DataTable />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders headers and rows with cell alignment", () => {
		const spec: DataTableSpec = {
			kind: "data_table",
			caption: "Plants per house",
			headers: ["Number of plants", "Frequency"],
			rows: [
				[
					{ value: "0", bold: false, align: "left" },
					{ value: "1", bold: false, align: "right" },
				],
				[
					{ value: "1", bold: false, align: "left" },
					{ value: "5", bold: false, align: "right" },
				],
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<DataTable spec={spec} />);
		});
		expect(container.querySelectorAll("th").length).toBe(2);
		expect(container.querySelectorAll("tbody tr").length).toBe(2);
		expect(container.textContent).toContain("Plants per house");
	});
});

describe("<EnglishPassage />", () => {
	let root: Root | null = null;
	let container: HTMLDivElement;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		root = null;
		document.body.replaceChildren();
	});

	it("renders one row per line with the line number", () => {
		const spec: EnglishPassageSpec = {
			kind: "english_passage",
			title: "Excerpt",
			source: "Anonymous",
			lines: [
				{ number: 1, text: "Line one of the poem." },
				{ number: 2, text: "Line two of the poem." },
				{ number: 3, text: "Line three of the poem." },
			],
		};
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root!.render(<EnglishPassage spec={spec} />);
		});
		expect(container.textContent).toContain("Excerpt");
		expect(container.textContent).toContain("Anonymous");
		expect(container.textContent).toContain("1");
		expect(container.textContent).toContain("Line one of the poem.");
		expect(container.textContent).toContain("3");
	});
});
