import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { QuestionVisualPdf } from "../practice-grading-pdf-visual";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

/**
 * Smoke tests for the PDF visual renderer. We run the actual @react-pdf
 * pipeline (renderToBuffer) so that any unsupported prop or primitive
 * misuse fails loudly here instead of in production. The buffer's content
 * is opaque PDF bytes; we only assert it's non-empty and starts with the
 * PDF magic.
 */

async function renderToPdfBuffer(visual: QuestionVisualEnvelope | null): Promise<Buffer> {
	const buf = await renderToBuffer(
		<Document>
			<Page size="A4">
				<QuestionVisualPdf visual={visual} />
			</Page>
		</Document>,
	);
	return buf instanceof Buffer ? buf : Buffer.from(buf);
}

function assertLooksLikePdf(buf: Buffer): void {
	expect(buf.length).toBeGreaterThan(200);
	expect(buf.slice(0, 4).toString()).toBe("%PDF");
}

describe("QuestionVisualPdf — render smoke", () => {
	it("returns a valid PDF when visual is null", async () => {
		const buf = await renderToPdfBuffer(null);
		assertLooksLikePdf(buf);
	});

	it("renders a math_geometry envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Slope of AB",
			altText: "Coordinate plane with two labelled points joined by a segment.",
			spec: {
				kind: "math_geometry",
				view: { xMin: 0, xMax: 6, yMin: 0, yMax: 10, showGrid: true, showAxes: true },
				primitives: [
					{ type: "point", at: { x: 1, y: 2 }, label: "A" },
					{ type: "point", at: { x: 4, y: 8 }, label: "B" },
					{ type: "segment", from: { x: 1, y: 2 }, to: { x: 4, y: 8 }, label: null, dashed: false },
					{
						type: "arc",
						center: { x: 1, y: 2 },
						radius: 2,
						startAngleDeg: 0,
						endAngleDeg: 90,
						minorArc: true,
						dashed: true,
						label: null,
					},
				],
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders a number_line envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Solution set",
			altText: "Number line from -2 to 2 with an open interval (-1, 1).",
			spec: {
				kind: "number_line",
				min: -2,
				max: 2,
				tickStep: 1,
				points: [{ value: 0, label: "0", openCircle: false }],
				intervals: [{ from: -1, to: 1, leftOpen: true, rightOpen: false, label: null }],
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders a free-body diagram envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Forces on the block",
			altText: "Block with two forces.",
			spec: {
				kind: "physics_diagram",
				subKind: "free_body",
				bodyLabel: "Block",
				forces: [
					{ name: "W", magnitude: 49, angleDeg: 270 },
					{ name: "N", magnitude: 42, angleDeg: 60 },
				],
				inclineDeg: 30,
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders a circuit envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Simple circuit",
			altText: "Battery, resistor, two wires forming a loop.",
			spec: {
				kind: "physics_diagram",
				subKind: "circuit",
				nodes: [
					{ id: "a", x: 0, y: 0 },
					{ id: "b", x: 4, y: 0 },
					{ id: "c", x: 4, y: 3 },
					{ id: "d", x: 0, y: 3 },
				],
				components: [
					{ type: "battery", from: "a", to: "b", emfVolts: 9, label: null },
					{ type: "resistor", from: "b", to: "c", resistanceOhms: 100, label: null },
					{ type: "wire", from: "c", to: "d" },
					{ type: "wire", from: "d", to: "a" },
				],
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders a chemistry_molecule envelope (text fallback path)", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Acetic acid",
			altText: "Carboxylic acid with two carbons.",
			spec: { kind: "chemistry_molecule", smiles: "CC(=O)O", display: "2d", label: null },
		});
		assertLooksLikePdf(buf);
	});

	it("renders an accountancy_table journal_entry envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Journal entry",
			altText: "Furniture purchased for cash.",
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
		});
		assertLooksLikePdf(buf);
	});

	it("renders a statistics_chart histogram envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Marks distribution",
			altText: "Histogram of marks across five class intervals.",
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
		});
		assertLooksLikePdf(buf);
	});

	it("renders a data_table envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Plants per house",
			altText: "Two-column data table.",
			spec: {
				kind: "data_table",
				caption: "Plants per house",
				headers: ["Plants", "Frequency"],
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
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders an english_passage envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Excerpt",
			altText: "Three-line poetry excerpt.",
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
		});
		assertLooksLikePdf(buf);
	});

	it("renders an india_map envelope", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Western littoral units",
			altText: "India map with Kerala, Karnataka, and Goa shaded.",
			spec: {
				kind: "india_map",
				mapStyle: "political",
				highlightedStates: ["kl", "ka", "ga"],
			},
		});
		assertLooksLikePdf(buf);
	});

	it("renders an economics_curve envelope (text fallback path)", async () => {
		const buf = await renderToPdfBuffer({
			caption: "Demand and supply",
			altText: "Two curves intersecting at equilibrium.",
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
		});
		assertLooksLikePdf(buf);
	});
});
