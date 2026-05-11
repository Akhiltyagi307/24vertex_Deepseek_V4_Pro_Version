import { z } from "zod";

import { INDIA_MAP_LOCATION_IDS } from "./india-map-regions";

/**
 * Zod schemas for question visuals (the structured `visual` field on every
 * generated practice question). The grouped output is what the model emits
 * via `generateObject`; the flat envelope is what the renderer consumes.
 *
 * Design notes
 * ─────────────
 * 1. Strict structured outputs (OpenAI). Every property must appear in
 *    `required`; optional → `nullable`. A `null` visual is the default and
 *    is encoded as a separate top-level union branch.
 * 2. No `z.record(...)` anywhere — those compile to `additionalProperties`
 *    or `patternProperties`, both of which OpenAI strict mode rejects.
 *    Tables use explicit field schemas; "rows" are arrays of typed objects.
 * 3. No `z.tuple(...)` for coordinates. Tuples compile to `prefixItems`
 *    which is supported but unusual. We use `{ x, y }` objects throughout
 *    for legibility in the model's output and easier diffing in patches.
 * 4. Coordinate ranges, bin labels, expressions are all strings/numbers
 *    the renderer is responsible for sanity-checking before drawing.
 *    The schema enforces shape; the renderer enforces semantics.
 */

const POINT_2D = z.object({
	x: z.number(),
	y: z.number(),
});
export type Point2D = z.infer<typeof POINT_2D>;

// ───────────────────────────────────────────────────────────────────────
// math_geometry
// ───────────────────────────────────────────────────────────────────────

const MATH_GEOMETRY_PRIMITIVE = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("point"),
		at: POINT_2D,
		label: z.string().max(24).nullable(),
	}),
	z.object({
		type: z.literal("segment"),
		from: POINT_2D,
		to: POINT_2D,
		label: z.string().max(24).nullable(),
		dashed: z.boolean().nullable(),
	}),
	z.object({
		type: z.literal("polygon"),
		vertices: z.array(POINT_2D).min(3).max(20),
		label: z.string().max(24).nullable(),
		filled: z.boolean().nullable(),
	}),
	z.object({
		type: z.literal("vector"),
		from: POINT_2D,
		to: POINT_2D,
		label: z.string().max(24).nullable(),
	}),
	z.object({
		type: z.literal("angle_marker"),
		vertex: POINT_2D,
		fromRayPoint: POINT_2D,
		toRayPoint: POINT_2D,
		label: z.string().max(24).nullable(),
	}),
	z.object({
		type: z.literal("circle"),
		center: POINT_2D,
		radius: z.number().positive(),
		label: z.string().max(24).nullable(),
	}),
	z.object({
		type: z.literal("arc"),
		center: POINT_2D,
		radius: z.number().positive(),
		startAngleDeg: z.number(),
		endAngleDeg: z.number(),
		minorArc: z.boolean().nullable(),
		dashed: z.boolean().nullable(),
		label: z.string().max(24).nullable(),
	}),
]);

const MATH_GEOMETRY_VIEW = z.object({
	xMin: z.number(),
	xMax: z.number(),
	yMin: z.number(),
	yMax: z.number(),
	showGrid: z.boolean(),
	showAxes: z.boolean(),
});

const MATH_GEOMETRY_SPEC = z.object({
	kind: z.literal("math_geometry"),
	view: MATH_GEOMETRY_VIEW,
	primitives: z.array(MATH_GEOMETRY_PRIMITIVE).min(1).max(40),
});

// ───────────────────────────────────────────────────────────────────────
// math_function_plot
// ───────────────────────────────────────────────────────────────────────

/** Each plotted function. `expr` follows mathjs syntax (sin(x), x^2, exp(-x^2)…). */
const MATH_FUNCTION_PLOT_ITEM = z.object({
	expr: z.string().min(1).max(120),
	color: z.enum(["primary", "secondary", "muted", "accent"]).nullable(),
	label: z.string().max(40).nullable(),
});

const MATH_FUNCTION_PLOT_SPEC = z.object({
	kind: z.literal("math_function_plot"),
	xMin: z.number(),
	xMax: z.number(),
	yMin: z.number().nullable(),
	yMax: z.number().nullable(),
	xLabel: z.string().max(40).nullable(),
	yLabel: z.string().max(40).nullable(),
	items: z.array(MATH_FUNCTION_PLOT_ITEM).min(1).max(4),
});

// ───────────────────────────────────────────────────────────────────────
// number_line
// ───────────────────────────────────────────────────────────────────────

const NUMBER_LINE_POINT = z.object({
	value: z.number(),
	label: z.string().max(24).nullable(),
	openCircle: z.boolean(),
});

const NUMBER_LINE_INTERVAL = z.object({
	from: z.number(),
	to: z.number(),
	leftOpen: z.boolean(),
	rightOpen: z.boolean(),
	label: z.string().max(40).nullable(),
});

const NUMBER_LINE_SPEC = z.object({
	kind: z.literal("number_line"),
	min: z.number(),
	max: z.number(),
	tickStep: z.number().positive(),
	points: z.array(NUMBER_LINE_POINT).max(20),
	intervals: z.array(NUMBER_LINE_INTERVAL).max(8),
});

// ───────────────────────────────────────────────────────────────────────
// physics_diagram (subKinds: free_body | ray_optics | circuit)
// ───────────────────────────────────────────────────────────────────────

const FREE_BODY_FORCE = z.object({
	name: z.string().min(1).max(20),
	magnitude: z.number().positive(),
	angleDeg: z.number().min(-360).max(360),
});

const PHYSICS_FREE_BODY = z.object({
	kind: z.literal("physics_diagram"),
	subKind: z.literal("free_body"),
	bodyLabel: z.string().min(1).max(40),
	forces: z.array(FREE_BODY_FORCE).min(1).max(8),
	inclineDeg: z.number().min(-90).max(90).nullable(),
});

const RAY_OPTICS_OBJECT = z.object({
	kind: z.enum(["object", "image"]),
	x: z.number(),
	height: z.number(),
	dashed: z.boolean(),
});

const RAY_OPTICS_LENS = z.object({
	type: z.enum(["concave_mirror", "convex_mirror", "concave_lens", "convex_lens"]),
	x: z.number(),
	focalLength: z.number().positive(),
});

const PHYSICS_RAY_OPTICS = z.object({
	kind: z.literal("physics_diagram"),
	subKind: z.literal("ray_optics"),
	axisMin: z.number(),
	axisMax: z.number(),
	objects: z.array(RAY_OPTICS_OBJECT).min(1).max(4),
	lenses: z.array(RAY_OPTICS_LENS).min(1).max(2),
});

const CIRCUIT_NODE = z.object({
	id: z.string().min(1).max(8),
	x: z.number(),
	y: z.number(),
});

const CIRCUIT_COMPONENT = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("battery"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		emfVolts: z.number().positive(),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("resistor"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		resistanceOhms: z.number().positive(),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("bulb"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("switch"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		closed: z.boolean(),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("ammeter"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("voltmeter"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
		label: z.string().max(20).nullable(),
	}),
	z.object({
		type: z.literal("wire"),
		from: z.string().min(1).max(8),
		to: z.string().min(1).max(8),
	}),
]);

const PHYSICS_CIRCUIT = z.object({
	kind: z.literal("physics_diagram"),
	subKind: z.literal("circuit"),
	nodes: z.array(CIRCUIT_NODE).min(2).max(20),
	components: z.array(CIRCUIT_COMPONENT).min(1).max(20),
});

const PHYSICS_DIAGRAM_SPEC = z.discriminatedUnion("subKind", [
	PHYSICS_FREE_BODY,
	PHYSICS_RAY_OPTICS,
	PHYSICS_CIRCUIT,
]);

// ───────────────────────────────────────────────────────────────────────
// chemistry_molecule
// ───────────────────────────────────────────────────────────────────────

const CHEMISTRY_MOLECULE_SPEC = z.object({
	kind: z.literal("chemistry_molecule"),
	smiles: z.string().min(1).max(240),
	display: z.enum(["2d", "3d"]),
	label: z.string().max(60).nullable(),
});

// ───────────────────────────────────────────────────────────────────────
// chemistry_reaction (mhchem)
// ───────────────────────────────────────────────────────────────────────

const CHEMISTRY_REACTION_SPEC = z.object({
	kind: z.literal("chemistry_reaction"),
	ce: z.string().min(1).max(360),
	label: z.string().max(120).nullable(),
});

// ───────────────────────────────────────────────────────────────────────
// accountancy_table
// ───────────────────────────────────────────────────────────────────────

const ACCOUNTANCY_JOURNAL_ROW = z.object({
	date: z.string().max(24),
	particulars: z.string().min(1).max(180),
	debit: z.number().nonnegative().nullable(),
	credit: z.number().nonnegative().nullable(),
	narration: z.string().max(200).nullable(),
});

const ACCOUNTANCY_LEDGER_SIDE_ENTRY = z.object({
	date: z.string().max(24),
	particulars: z.string().min(1).max(180),
	amount: z.number().nonnegative(),
});

const ACCOUNTANCY_LEDGER_TABLE = z.object({
	accountName: z.string().min(1).max(80),
	debitSide: z.array(ACCOUNTANCY_LEDGER_SIDE_ENTRY).max(20),
	creditSide: z.array(ACCOUNTANCY_LEDGER_SIDE_ENTRY).max(20),
});

const ACCOUNTANCY_TRIAL_BALANCE_ROW = z.object({
	particulars: z.string().min(1).max(120),
	debit: z.number().nonnegative().nullable(),
	credit: z.number().nonnegative().nullable(),
});

const ACCOUNTANCY_BALANCE_SHEET_ROW = z.object({
	particulars: z.string().min(1).max(160),
	amount: z.number().nullable(),
	indent: z.number().int().min(0).max(3),
	bold: z.boolean(),
});

const ACCOUNTANCY_TABLE_JOURNAL = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("journal_entry"),
	rows: z.array(ACCOUNTANCY_JOURNAL_ROW).min(1).max(40),
});

const ACCOUNTANCY_TABLE_LEDGER = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("ledger"),
	ledger: ACCOUNTANCY_LEDGER_TABLE,
});

const ACCOUNTANCY_TABLE_TRIAL_BALANCE = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("trial_balance"),
	rows: z.array(ACCOUNTANCY_TRIAL_BALANCE_ROW).min(1).max(60),
});

const ACCOUNTANCY_TABLE_BALANCE_SHEET = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("balance_sheet"),
	assetsSide: z.array(ACCOUNTANCY_BALANCE_SHEET_ROW).min(1).max(60),
	equityAndLiabilitiesSide: z.array(ACCOUNTANCY_BALANCE_SHEET_ROW).min(1).max(60),
});

const ACCOUNTANCY_TABLE_PNL = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("p_and_l"),
	rows: z.array(ACCOUNTANCY_BALANCE_SHEET_ROW).min(1).max(80),
});

const ACCOUNTANCY_TABLE_CASH_BOOK = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("cash_book"),
	rows: z.array(ACCOUNTANCY_JOURNAL_ROW).min(1).max(40),
});

const ACCOUNTANCY_TABLE_RECTIFICATION = z.object({
	kind: z.literal("accountancy_table"),
	subKind: z.literal("rectification"),
	rows: z.array(ACCOUNTANCY_JOURNAL_ROW).min(1).max(40),
});

const ACCOUNTANCY_TABLE_SPEC = z.discriminatedUnion("subKind", [
	ACCOUNTANCY_TABLE_JOURNAL,
	ACCOUNTANCY_TABLE_LEDGER,
	ACCOUNTANCY_TABLE_TRIAL_BALANCE,
	ACCOUNTANCY_TABLE_BALANCE_SHEET,
	ACCOUNTANCY_TABLE_PNL,
	ACCOUNTANCY_TABLE_CASH_BOOK,
	ACCOUNTANCY_TABLE_RECTIFICATION,
]);

// ───────────────────────────────────────────────────────────────────────
// economics_curve
// ───────────────────────────────────────────────────────────────────────

const ECONOMICS_CURVE_ITEM = z.object({
	expr: z.string().min(1).max(120),
	color: z.enum(["primary", "secondary", "muted", "accent"]).nullable(),
	label: z.string().max(40),
});

const ECONOMICS_MARK = z.object({
	x: z.number(),
	y: z.number(),
	label: z.string().min(1).max(40),
});

const ECONOMICS_CURVE_SPEC = z.object({
	kind: z.literal("economics_curve"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	xMin: z.number(),
	xMax: z.number(),
	yMin: z.number().nullable(),
	yMax: z.number().nullable(),
	curves: z.array(ECONOMICS_CURVE_ITEM).min(1).max(4),
	marks: z.array(ECONOMICS_MARK).max(8),
});

// ───────────────────────────────────────────────────────────────────────
// statistics_chart (subKinds: histogram | bar | line | scatter | pie | …)
// ───────────────────────────────────────────────────────────────────────

const STATS_BIN = z.object({
	label: z.string().min(1).max(24),
	frequency: z.number().nonnegative(),
});

const STATS_BAR_DATUM = z.object({
	label: z.string().min(1).max(40),
	value: z.number(),
});

const STATS_LINE_POINT = z.object({
	x: z.number(),
	y: z.number(),
});

const STATS_SCATTER_POINT = z.object({
	x: z.number(),
	y: z.number(),
	label: z.string().max(24).nullable(),
});

const STATS_PIE_SLICE = z.object({
	label: z.string().min(1).max(40),
	value: z.number().nonnegative(),
});

const STATS_HIST = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("histogram"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	bins: z.array(STATS_BIN).min(2).max(40),
});

const STATS_BAR = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("bar"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	data: z.array(STATS_BAR_DATUM).min(1).max(40),
});

const STATS_LINE = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("line"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	series: z
		.array(
			z.object({
				name: z.string().min(1).max(40),
				points: z.array(STATS_LINE_POINT).min(2).max(80),
			}),
		)
		.min(1)
		.max(4),
});

const STATS_SCATTER = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("scatter"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	points: z.array(STATS_SCATTER_POINT).min(2).max(120),
});

const STATS_PIE = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("pie"),
	slices: z.array(STATS_PIE_SLICE).min(2).max(10),
});

const STATS_FREQUENCY_POLYGON = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("frequency_polygon"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	bins: z.array(STATS_BIN).min(2).max(40),
});

const STATS_OGIVE = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("ogive"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	bins: z.array(STATS_BIN).min(2).max(40),
	cumulative: z.enum(["less_than", "more_than"]),
});

const STATS_BOX = z.object({
	kind: z.literal("statistics_chart"),
	subKind: z.literal("box"),
	xLabel: z.string().min(1).max(40),
	yLabel: z.string().min(1).max(40),
	groups: z
		.array(
			z.object({
				name: z.string().min(1).max(40),
				min: z.number(),
				q1: z.number(),
				median: z.number(),
				q3: z.number(),
				max: z.number(),
			}),
		)
		.min(1)
		.max(8),
});

const STATISTICS_CHART_SPEC = z.discriminatedUnion("subKind", [
	STATS_HIST,
	STATS_BAR,
	STATS_LINE,
	STATS_SCATTER,
	STATS_PIE,
	STATS_FREQUENCY_POLYGON,
	STATS_OGIVE,
	STATS_BOX,
]);

// ───────────────────────────────────────────────────────────────────────
// data_table (generic stimulus tables)
// ───────────────────────────────────────────────────────────────────────

const DATA_TABLE_CELL = z.object({
	value: z.string().max(140),
	bold: z.boolean(),
	align: z.enum(["left", "center", "right"]),
});

const DATA_TABLE_SPEC = z.object({
	kind: z.literal("data_table"),
	caption: z.string().max(120).nullable(),
	headers: z.array(z.string().min(1).max(60)).min(1).max(10),
	rows: z.array(z.array(DATA_TABLE_CELL).min(1).max(10)).min(1).max(30),
});

// ───────────────────────────────────────────────────────────────────────
// india_map (India admin boundaries — @svg-maps/india)
// ───────────────────────────────────────────────────────────────────────

const INDIA_MAP_LOCATION_ID = z.enum(INDIA_MAP_LOCATION_IDS);

const INDIA_MAP_SPEC = z.object({
	kind: z.literal("india_map"),
	/** Visual treatment; null defaults to political-style fills in renderers. */
	mapStyle: z.enum(["political", "outline", "physical_palette"]).nullable(),
	/** Lowercase ids matching @svg-maps/india paths (e.g. rj, mh, tn). Null or [] = no highlight. */
	highlightedStates: z.array(INDIA_MAP_LOCATION_ID).max(INDIA_MAP_LOCATION_IDS.length).nullable(),
});

// ───────────────────────────────────────────────────────────────────────
// english_passage (line-numbered stimulus prose)
// ───────────────────────────────────────────────────────────────────────

const ENGLISH_PASSAGE_LINE = z.object({
	number: z.number().int().positive(),
	text: z.string().min(1).max(300),
});

const ENGLISH_PASSAGE_SPEC = z.object({
	kind: z.literal("english_passage"),
	title: z.string().max(140).nullable(),
	source: z.string().max(140).nullable(),
	lines: z.array(ENGLISH_PASSAGE_LINE).min(1).max(60),
});

// ───────────────────────────────────────────────────────────────────────
// Top-level union of every spec kind
//
// Zod 3 forbids nested discriminated unions, so we use a plain `z.union(...)`
// at the top level. Compiles to JSON-schema `oneOf` (which OpenAI strict
// structured outputs accepts). Each branch still carries a literal `kind`
// (and a literal `subKind` for families that have one), so the model still
// gets a clear discriminator for selection.
// ───────────────────────────────────────────────────────────────────────

export const questionVisualSpecSchema = z.union([
	MATH_GEOMETRY_SPEC,
	MATH_FUNCTION_PLOT_SPEC,
	NUMBER_LINE_SPEC,
	PHYSICS_DIAGRAM_SPEC,
	CHEMISTRY_MOLECULE_SPEC,
	CHEMISTRY_REACTION_SPEC,
	ACCOUNTANCY_TABLE_SPEC,
	ECONOMICS_CURVE_SPEC,
	STATISTICS_CHART_SPEC,
	DATA_TABLE_SPEC,
	INDIA_MAP_SPEC,
	ENGLISH_PASSAGE_SPEC,
]);

export const questionVisualEnvelopeSchema = z
	.object({
		caption: z.string().min(1).max(200),
		altText: z.string().min(1).max(500),
		spec: questionVisualSpecSchema,
	})
	.superRefine((val, ctx) => {
		const s = val.spec;
		if (s.kind === "math_function_plot") {
			if (s.xMax <= s.xMin) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "math_function_plot: xMax must be greater than xMin",
					path: ["spec"],
				});
			}
			if (s.yMin != null && s.yMax != null && s.yMax <= s.yMin) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "math_function_plot: yMax must exceed yMin when both are set",
					path: ["spec"],
				});
			}
		}
		if (s.kind === "economics_curve") {
			if (s.xMax <= s.xMin) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "economics_curve: xMax must exceed xMin",
					path: ["spec"],
				});
			}
			if (s.yMin != null && s.yMax != null && s.yMax <= s.yMin) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "economics_curve: yMax must exceed yMin when both vertical bounds are set",
					path: ["spec"],
				});
			}
		}
		if (s.kind === "number_line") {
			if (s.max <= s.min) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "number_line: max must exceed min",
					path: ["spec"],
				});
			}
			if (s.tickStep <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "number_line: tickStep must be positive",
					path: ["spec"],
				});
			}
		}
		if (s.kind === "math_geometry") {
			const v = s.view;
			if (v.xMax <= v.xMin || v.yMax <= v.yMin) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "math_geometry: view must have positive width and height",
					path: ["spec", "view"],
				});
			}
		}
		if (s.kind === "india_map" && s.highlightedStates && s.highlightedStates.length > 0) {
			const uniq = new Set(s.highlightedStates);
			if (uniq.size !== s.highlightedStates.length) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "india_map: highlightedStates must not repeat ids",
					path: ["spec", "highlightedStates"],
				});
			}
		}
	});

export type QuestionVisualEnvelope = z.infer<typeof questionVisualEnvelopeSchema>;
export type QuestionVisualSpec = z.infer<typeof questionVisualSpecSchema>;

// Per-kind exported types for renderer consumption (narrowed by `kind`/`subKind`).
export type MathGeometrySpec = z.infer<typeof MATH_GEOMETRY_SPEC>;
export type MathFunctionPlotSpec = z.infer<typeof MATH_FUNCTION_PLOT_SPEC>;
export type NumberLineSpec = z.infer<typeof NUMBER_LINE_SPEC>;
export type PhysicsDiagramSpec = z.infer<typeof PHYSICS_DIAGRAM_SPEC>;
export type ChemistryMoleculeSpec = z.infer<typeof CHEMISTRY_MOLECULE_SPEC>;
export type ChemistryReactionSpec = z.infer<typeof CHEMISTRY_REACTION_SPEC>;
export type AccountancyTableSpec = z.infer<typeof ACCOUNTANCY_TABLE_SPEC>;
export type EconomicsCurveSpec = z.infer<typeof ECONOMICS_CURVE_SPEC>;
export type StatisticsChartSpec = z.infer<typeof STATISTICS_CHART_SPEC>;
export type DataTableSpec = z.infer<typeof DATA_TABLE_SPEC>;
export type IndiaMapSpec = z.infer<typeof INDIA_MAP_SPEC>;
export type EnglishPassageSpec = z.infer<typeof ENGLISH_PASSAGE_SPEC>;

/** Stable list of accepted kind discriminators (used by gates and policy). */
export const QUESTION_VISUAL_KINDS = [
	"math_geometry",
	"math_function_plot",
	"number_line",
	"physics_diagram",
	"chemistry_molecule",
	"chemistry_reaction",
	"accountancy_table",
	"economics_curve",
	"statistics_chart",
	"data_table",
	"india_map",
	"english_passage",
] as const;
export type QuestionVisualKind = (typeof QUESTION_VISUAL_KINDS)[number];
