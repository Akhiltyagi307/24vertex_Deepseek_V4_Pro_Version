/**
 * Public TypeScript surface for question visuals. Re-exports the inferred
 * Zod types so renderers and gates do not need to depend on `zod` directly.
 */

export type {
	QuestionVisualEnvelope,
	QuestionVisualSpec,
	QuestionVisualKind,
	MathGeometrySpec,
	MathFunctionPlotSpec,
	NumberLineSpec,
	PhysicsDiagramSpec,
	ChemistryMoleculeSpec,
	ChemistryReactionSpec,
	AccountancyTableSpec,
	EconomicsCurveSpec,
	StatisticsChartSpec,
	DataTableSpec,
	IndiaMapSpec,
	EnglishPassageSpec,
	Point2D,
} from "./schemas";

export { QUESTION_VISUAL_KINDS } from "./schemas";

/**
 * Result of safe-parsing a stored visual envelope from `questions.metadata`.
 * The reader prefers logging+null-on-failure to crashing the page when
 * a malformed visual lands in the DB. See `parseStoredQuestionVisual`.
 */
export type ParseStoredQuestionVisualResult =
	| { ok: true; envelope: import("./schemas").QuestionVisualEnvelope | null }
	| { ok: false; reason: string };
