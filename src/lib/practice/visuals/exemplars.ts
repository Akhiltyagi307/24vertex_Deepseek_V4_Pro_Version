/**
 * Few-shot exemplars for the `visual` field. The shared system instructions
 * append a "## Examples" block built from this list so the model has
 * concrete shapes to imitate.
 *
 * Curation rules:
 * - Mix `visual: null` with non-null examples — the default is null and the
 *   model needs to see that confirmed in worked examples.
 * - Keep stems short and self-contained; the visual is load-bearing OR the
 *   stem stands alone, never both repeating the same data.
 * - Cover visual kinds shipped for Phase 2. Selection uses stratified sampling
 *   by `spec.kind` in `pickExemplarsForSubject`.
 */

import type { QuestionVisualEnvelope } from "./schemas";

export type VisualExemplar = {
	stem: string;
	visual: QuestionVisualEnvelope | null;
	subjects: ReadonlyArray<
		"mathematics" | "physics" | "chemistry" | "accountancy" | "economics_statistics" | "science" | "english"
	>;
};

export const VISUAL_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	{
		stem: "Solve for x: $2x + 5 = 17$.",
		visual: null,
		subjects: ["mathematics"],
	},
	{
		stem: "Find the slope of segment AB shown below.",
		visual: {
			caption: "Segment AB on the coordinate plane.",
			altText:
				"Coordinate plane with point A at (1, 2) and point B at (4, 8) joined by a segment.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 6, yMin: 0, yMax: 10, showGrid: true, showAxes: true },
				primitives: [
					{ type: "point", at: { x: 1, y: 2 }, label: "A" },
					{ type: "point", at: { x: 4, y: 8 }, label: "B" },
					{ type: "segment", from: { x: 1, y: 2 }, to: { x: 4, y: 8 }, label: null, dashed: false },
				],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "For the graph of $y = x^2 - 4$ shown, state the y-coordinate of the vertex.",
		visual: {
			caption: "Graph of the quadratic function on the given window.",
			altText:
				"Upward-opening parabola on a grid with horizontal x-axis and vertical y-axis; vertex at the lowest point of the curve within the window.",
			spec: {
				kind: "math_function_plot",
				xMin: -4,
				xMax: 4,
				yMin: -6,
				yMax: 8,
				xLabel: "x",
				yLabel: "y",
				items: [{ expr: "x^2 - 4", color: "primary", label: null }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem: "Which inequality matches the interval highlighted on the number line below?",
		visual: {
			caption: "Number line from 0 to 6 with a ray starting at 2.",
			altText:
				"Integer tick marks from 0 through 6; solid dot at 2 and a thick segment extending right with an open end at 6.",
			spec: {
				kind: "number_line",
				min: 0,
				max: 6,
				tickStep: 1,
				points: [{ value: 2, label: "2", openCircle: false }],
				intervals: [{ from: 2, to: 6, leftOpen: false, rightOpen: true, label: null }],
			},
		},
		subjects: ["mathematics"],
	},
	{
		stem:
			"The diagram shows a block on a frictionless 30° incline with weight W = 49 N and normal N. What is the magnitude of N?",
		visual: {
			caption: "Weight and normal on a block on an incline.",
			altText:
				"Block on a 30 degree slope; weight arrow pointing vertically down labelled W; normal arrow perpendicular to the surface labelled N.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 49, angleDeg: 270 },
					{ name: "N", magnitude: 42.4, angleDeg: 60 },
				],
				inclineDeg: 30,
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "For the circuit shown, through which component does conventional current leave the positive terminal of the battery?",
		visual: {
			caption: "Single-loop circuit with a battery and resistor.",
			altText:
				"Two labelled nodes; a 12 volt battery and a 4 ohm resistor form one closed loop between them.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "n1", x: 0, y: 1 },
					{ id: "n2", x: 4, y: 1 },
				],
				components: [
					{ type: "battery", from: "n1", to: "n2", emfVolts: 12, label: "12 V" },
					{ type: "resistor", from: "n2", to: "n1", resistanceOhms: 4, label: "R" },
				],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "In the ray diagram below, where is the convex lens located on the principal axis?",
		visual: {
			caption: "Object and convex lens on a principal axis.",
			altText:
				"Horizontal axis from negative to positive positions; small object arrow left of centre; convex lens marker at the origin.",
			spec: {
				kind: "physics_diagram",
				subKind: "ray_optics",
				axisMin: -20,
				axisMax: 20,
				objects: [{ kind: "object", x: -10, height: 2, dashed: false }],
				lenses: [{ type: "convex_lens", x: 0, focalLength: 10 }],
			},
		},
		subjects: ["physics", "science"],
	},
	{
		stem: "Identify the functional group present in the molecule shown.",
		visual: {
			caption: "Skeletal structure of a small organic molecule.",
			altText:
				"Two-carbon backbone with a carbonyl carbon bonded to an OH group and a methyl group; layout shown for the assessment diagram.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CC(=O)O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Classify the reaction shown: is it synthesis, decomposition, or displacement?",
		visual: {
			caption: "Formation of water from hydrogen and oxygen.",
			altText: "Chemical equation with hydrogen and oxygen as reactants and water as product; no balancing hints in the caption.",
			spec: {
				kind: "chemistry_reaction",
				ce: "2 H2 + O2 -> 2 H2O",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Complete the journal entry for purchase of furniture for ₹15,000 cash on 1 April 2026 using the skeleton below.",
		visual: {
			caption: "Blank journal entry form.",
			altText:
				"Columns for date, particulars, debit, and credit; headings indicate furniture purchase on 1 April with blank amount cells for the student.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-01",
						particulars: "Furniture A/c           Dr.",
						debit: null,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: null,
						narration: null,
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Which class interval is the modal class in the histogram shown?",
		visual: {
			caption: "Frequency distribution of marks.",
			altText:
				"Histogram with five adjacent class intervals on the horizontal axis and frequency on the vertical axis; bar heights vary across intervals.",
			spec: {
				kind: "statistics_chart",
				subKind: "histogram",
				xLabel: "Marks",
				yLabel: "Frequency",
				bins: [
					{ label: "10-20", frequency: 4 },
					{ label: "20-30", frequency: 7 },
					{ label: "30-40", frequency: 12 },
					{ label: "40-50", frequency: 9 },
					{ label: "50-60", frequency: 3 },
				],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "Use the demand and supply curves shown to read the equilibrium price and quantity at their intersection.",
		visual: {
			caption: "Market diagram with downward demand and upward supply.",
			altText:
				"Quantity on the horizontal axis, price on the vertical; two curves meet at a point labelled equilibrium in the first quadrant.",
			spec: {
				kind: "economics_curve",
				xLabel: "Quantity",
				yLabel: "Price",
				xMin: 0,
				xMax: 200,
				yMin: 0,
				yMax: 100,
				curves: [
					{ expr: "80 - 0.4 * p", color: "primary", label: "Demand" },
					{ expr: "0.4 * p", color: "secondary", label: "Supply" },
				],
				marks: [{ x: 100, y: 40, label: "Equilibrium" }],
			},
		},
		subjects: ["economics_statistics"],
	},
	{
		stem: "From the data table, find the mean number of plants per house.",
		visual: {
			caption: "Plants per house — survey of 25 houses.",
			altText:
				"Two-column data table: number of plants 0 to 5 against frequency, frequencies summing to 25.",
			spec: {
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
					[
						{ value: "2", bold: false, align: "left" },
						{ value: "8", bold: false, align: "right" },
					],
					[
						{ value: "3", bold: false, align: "left" },
						{ value: "6", bold: false, align: "right" },
					],
					[
						{ value: "4", bold: false, align: "left" },
						{ value: "3", bold: false, align: "right" },
					],
					[
						{ value: "5", bold: false, align: "left" },
						{ value: "2", bold: false, align: "right" },
					],
				],
			},
		},
		subjects: ["economics_statistics", "mathematics"],
	},
	{
		stem:
			"Read the passage and identify the figure of speech used in line 3.",
		visual: {
			caption: "Numbered poem excerpt (lines 1–3).",
			altText:
				"Three short lines of verse, each prefixed by its line number; no interpretation of the literary device is stated.",
			spec: {
				kind: "english_passage",
				title: null,
				source: null,
				lines: [
					{ number: 1, text: "Across the dawn the river ran," },
					{ number: 2, text: "A silver thread through fields of wheat," },
					{ number: 3, text: "The wind bent down to whisper softly." },
				],
			},
		},
		subjects: ["english"],
	},
];

function exemplarKindKey(ex: VisualExemplar): string {
	if (ex.visual === null) return "__null__";
	const s = ex.visual.spec;
	if (s.kind === "physics_diagram") return `physics_diagram:${s.subKind}`;
	return s.kind;
}

/**
 * Subset selection: anchor with a null-visual example, then add exemplars
 * maximizing distinct `spec.kind` (and physics `subKind`) for the subject.
 */
export function pickExemplarsForSubject(
	subjectKey: VisualExemplar["subjects"][number],
	limit = 6,
): ReadonlyArray<VisualExemplar> {
	const matching = VISUAL_EXEMPLARS.filter((ex) => ex.subjects.includes(subjectKey));
	const anchor =
		matching.find((ex) => ex.visual === null) ??
		VISUAL_EXEMPLARS.find((ex) => ex.visual === null) ??
		matching[0];
	if (!anchor) return [];

	const matchingRest = matching.filter((ex) => ex !== anchor);
	const otherRest = VISUAL_EXEMPLARS.filter((ex) => ex !== anchor && !matching.includes(ex));
	const orderedPool = [...matchingRest, ...otherRest];

	const picked: VisualExemplar[] = [anchor];
	const seenKinds = new Set<string>([exemplarKindKey(anchor)]);

	while (picked.length < limit && orderedPool.length > 0) {
		let bestIdx = 0;
		let bestScore = -1;
		for (let i = 0; i < orderedPool.length; i++) {
			const ex = orderedPool[i]!;
			const k = exemplarKindKey(ex);
			const score = seenKinds.has(k) ? 0 : 1;
			if (score > bestScore) {
				bestScore = score;
				bestIdx = i;
			}
		}
		const next = orderedPool.splice(bestIdx, 1)[0]!;
		picked.push(next);
		seenKinds.add(exemplarKindKey(next));
	}

	return picked.slice(0, limit);
}
