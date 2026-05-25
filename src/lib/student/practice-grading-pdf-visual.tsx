/**
 * PDF-side visual dispatcher. Mirrors the on-screen `<QuestionVisual />`
 * but maps the QuestionVisualEnvelope onto @react-pdf primitives instead
 * of the React-DOM renderers (Mafs / function-plot / smiles-drawer / etc.).
 *
 * Coverage in v1:
 *   - HIGH fidelity (native SVG/View): math_geometry, number_line,
 *     physics_diagram (all subKinds), accountancy_table, data_table,
 *     english_passage, india_map, statistics_chart (histogram, bar, line, scatter,
 *     frequency_polygon, ogive).
 *   - TEXT fallback (caption + altText + raw spec string): chemistry_molecule
 *     (no SMILES parser in PDF), chemistry_reaction (no KaTeX/mhchem in
 *     PDF), math_function_plot, economics_curve (no expression evaluator
 *     in PDF), statistics_chart (pie, box).
 *
 * Every kind always produces SOMETHING for the PDF — students never see a
 * blank "visual referenced but missing" gap. Bad/legacy specs are caught
 * by `parseStoredQuestionVisualFromMetadata` upstream and arrive here as
 * `null`, which collapses to no rendering.
 */

import { Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";

import type {
	AccountancyTableSpec,
	ChemistryMoleculeSpec,
	ChemistryReactionSpec,
	DataTableSpec,
	EconomicsCurveSpec,
	EnglishPassageSpec,
	IndiaMapSpec,
	MathFunctionPlotSpec,
	MathGeometrySpec,
	NumberLineSpec,
	PhysicsDiagramSpec,
	QuestionVisualEnvelope,
	StatisticsChartSpec,
} from "@/lib/practice/visuals/types";

import { RenderSpec } from "@/lib/student/practice-grading-pdf-visual-kinds";
import { pdfVisualStyles as styles } from "@/lib/student/practice-grading-pdf-visual-tokens";

export function QuestionVisualPdf({
	visual,
}: {
	visual: QuestionVisualEnvelope | null;
}): ReactElement | null {
	if (!visual) return null;
	return (
		<View style={styles.wrapper} wrap={false}>
			<RenderSpec visual={visual} />
			<Text style={styles.caption}>{visual.caption}</Text>
		</View>
	);
}

// Force the imports of unused types to keep TS happy (centralised — they are
// referenced by the per-kind components above).
export type _PdfRendererTypes = {
	AccountancyTableSpec: AccountancyTableSpec;
	ChemistryMoleculeSpec: ChemistryMoleculeSpec;
	ChemistryReactionSpec: ChemistryReactionSpec;
	DataTableSpec: DataTableSpec;
	EconomicsCurveSpec: EconomicsCurveSpec;
	EnglishPassageSpec: EnglishPassageSpec;
	IndiaMapSpec: IndiaMapSpec;
	MathFunctionPlotSpec: MathFunctionPlotSpec;
	MathGeometrySpec: MathGeometrySpec;
	NumberLineSpec: NumberLineSpec;
	PhysicsDiagramSpec: PhysicsDiagramSpec;
	StatisticsChartSpec: StatisticsChartSpec;
};

export type _PdfRendererNodes = ReactNode;
