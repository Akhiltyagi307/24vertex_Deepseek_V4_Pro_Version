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
 * - Cover one example per visual kind we ship in Phase 2. Per-subject
 *   filtering happens at prompt-build time in
 *   `buildPracticeGenerationSharedSystemInstructions`.
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
		stem: "Sketch the graph of $y = x^2 - 4$ on the given range and identify the x-intercepts.",
		visual: {
			caption: "Parabola y = x² − 4.",
			altText:
				"Upward parabola crossing the x-axis at x = -2 and x = 2 with vertex at (0, -4).",
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
		stem:
			"A 5 kg block on a frictionless incline of 30° is released. Identify the magnitude of the net force shown below.",
		visual: {
			caption: "Forces on the block.",
			altText:
				"Block on a 30 degree incline with weight straight down and normal perpendicular to the surface.",
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
		stem: "Identify the functional group present in the molecule shown.",
		visual: {
			caption: "Acetic acid.",
			altText: "Two-carbon carboxylic acid CH3COOH with a methyl and a carboxyl group.",
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
		stem: "Pass the journal entry for purchase of furniture for ₹15,000 in cash on 1 April 2026.",
		visual: {
			caption: "Skeleton journal entry.",
			altText:
				"Date column, particulars column, debit and credit columns with a partly filled debit row and a credit row blank.",
			spec: {
				kind: "accountancy_table",
				subKind: "journal_entry",
				rows: [
					{
						date: "2026-04-01",
						particulars: "Furniture A/c           Dr.",
						debit: 15000,
						credit: null,
						narration: null,
					},
					{
						date: "",
						particulars: "    To Cash A/c",
						debit: null,
						credit: 15000,
						narration: "(Being furniture purchased for cash)",
					},
				],
			},
		},
		subjects: ["accountancy"],
	},
	{
		stem: "Read the modal class from the histogram shown.",
		visual: {
			caption: "Frequency distribution of marks.",
			altText: "Histogram with five class intervals; the 30-40 bar is the tallest at 12.",
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
		stem: "From the demand and supply curves shown, identify the equilibrium price and quantity.",
		visual: {
			caption: "Market for apples.",
			altText:
				"Downward sloping demand curve and upward sloping supply curve intersecting at price 40 and quantity 100.",
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
			caption: "Excerpt from a poem.",
			altText:
				"Three-line excerpt from a poem; line 3 contains a personification of the wind.",
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

/** Subset selection: returns up to N exemplars relevant to a subject family. */
export function pickExemplarsForSubject(
	subjectKey: VisualExemplar["subjects"][number],
	limit = 4,
): ReadonlyArray<VisualExemplar> {
	const matching = VISUAL_EXEMPLARS.filter((ex) => ex.subjects.includes(subjectKey));
	if (matching.length >= limit) return matching.slice(0, limit);
	// Always anchor with the null-visual algebra example so the default sticks.
	const anchor = VISUAL_EXEMPLARS[0];
	const remainder = VISUAL_EXEMPLARS.filter((ex) => ex !== anchor && !matching.includes(ex));
	return [anchor, ...matching, ...remainder].slice(0, limit);
}
