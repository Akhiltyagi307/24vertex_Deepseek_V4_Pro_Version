import type { QuestionVisualKind } from "./types";
import {
	buildChemistryMoleculeIdeaAwareEnvelope,
	buildChemistryReactionIdeaAwareEnvelope,
	buildMathFunctionPlotIdeaAwareEnvelope,
	buildMathGeometryIdeaAwareEnvelope,
	buildPhysicsIdeaAwareEnvelope,
	COORD_GEOMETRY_2D_RE,
	shortCaptionFromIdea,
} from "./fallback-visual-idea-aware";
import {
	questionVisualEnvelopeSchema,
	type QuestionVisualEnvelope,
} from "./schemas";

function extractNumbers(text: string): string[] {
	return [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => match[0]).slice(0, 6);
}

function extractNumberValues(text: string): number[] {
	return extractNumbers(text)
		.map((token) => Number(token))
		.filter((value) => Number.isFinite(value));
}

/**
 * Numeric-only table fallback. Never paste the prose stem into cells — that
 * produced redundant “visuals” identical to the question text.
 */
function buildDataTableFallback(questionText: string): QuestionVisualEnvelope | null {
	const numbers = extractNumbers(questionText);
	if (numbers.length === 0) return null;
	const rows = numbers.map((value, idx) => [
		{ value: `Given ${idx + 1}`, bold: false, align: "left" as const },
		{ value, bold: false, align: "right" as const },
	]);
	return {
		caption: "Numeric givens from the question in tabular form.",
		altText: "A two-column table pairing each labeled given with its numeric value from the stem.",
		spec: {
			kind: "data_table",
			caption: null,
			headers: ["Given", "Value"],
			rows,
		},
	};
}

function buildNumberLineGroundedFallback(questionText: string): QuestionVisualEnvelope | null {
	const values = extractNumberValues(questionText);
	if (values.length === 0) return null;
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const allIntegers = values.every((value) => Number.isInteger(value));
	const padding = allIntegers ? 1 : 0.5;
	const tickStep = allIntegers ? 1 : 0.5;
	const points = values.slice(0, 4).map((value, index) => ({
		value,
		label: `Given ${index + 1}`,
		openCircle: false,
	}));
	return {
		caption: "Number line built from the question's given values.",
		altText: "A number line marking numeric givens taken directly from the question stem.",
		spec: {
			kind: "number_line",
			min: Math.floor((minValue - padding) / tickStep) * tickStep,
			max: Math.ceil((maxValue + padding) / tickStep) * tickStep,
			tickStep,
			minorTickStep: null,
			axisLabel: null,
			points,
			intervals: [],
		},
	};
}

function buildStatisticsGroundedFallback(questionText: string): QuestionVisualEnvelope | null {
	const values = extractNumberValues(questionText);
	if (values.length < 2) return null;
	return {
		caption: "Grounded comparison chart using values from the question.",
		altText: "A bar chart where each bar corresponds to a numeric value given in the question.",
		spec: {
			kind: "statistics_chart",
			subKind: "bar",
			xLabel: "Given",
			yLabel: "Value",
			data: values.slice(0, 6).map((value, index) => ({ label: `Given ${index + 1}`, value })),
		},
	};
}

function buildFallbackByKind(kind: QuestionVisualKind, questionText: string): unknown {
	switch (kind) {
		case "data_table":
			return buildDataTableFallback(questionText);
		case "math_function_plot":
			return {
				caption: "Reference line graph to support interpretation.",
				altText: "A simple line graph with x and y axes and one plotted line.",
				spec: {
					kind: "math_function_plot",
					xMin: 0,
					xMax: 10,
					yMin: 0,
					yMax: 10,
					xLabel: "x",
					yLabel: "y",
					xTickStep: 2,
					yTickStep: 2,
					items: [{ expr: "x", color: "primary", label: "y = x" }],
				},
			};
		case "number_line":
			return {
				caption: "Number line support for the question setup.",
				altText: "A number line from 0 to 10 with one marked reference point.",
				spec: {
					kind: "number_line",
					min: 0,
					max: 10,
					tickStep: 1,
					minorTickStep: null,
					axisLabel: null,
					points: [{ value: 5, label: "Reference", openCircle: false }],
					intervals: [],
				},
			};
		case "statistics_chart":
			return {
				caption: "Simple bar chart scaffold for quick comparison.",
				altText: "A bar chart with two categories and corresponding values.",
				spec: {
					kind: "statistics_chart",
					subKind: "bar",
					xLabel: "Category",
					yLabel: "Value",
					data: [
						{ label: "A", value: 1 },
						{ label: "B", value: 2 },
					],
				},
			};
		case "economics_curve":
			return {
				caption: "Reference demand-style curve for interpretation.",
				altText: "A downward sloping curve on quantity and price axes.",
				spec: {
					kind: "economics_curve",
					xLabel: "Quantity",
					yLabel: "Price",
					xMin: 0,
					xMax: 10,
					yMin: 0,
					yMax: 10,
					curves: [{ expr: "10 - x", color: "primary", label: "Demand" }],
					marks: [],
				},
			};
		case "physics_diagram":
			return {
				caption: "Reference free-body diagram scaffold.",
				altText: "A body with one force arrow shown for analysis.",
				spec: {
					kind: "physics_diagram",
					subKind: "free_body",
					bodyLabel: "Body",
					forces: [
						{
							name: "F",
							magnitude: 10,
							angleDeg: 0,
							unit: "N",
							showMagnitude: true,
							componentArrows: false,
						},
					],
					inclineDeg: null,
					inclineLabel: null,
					surfaceHatched: null,
					axisLegend: null,
				},
			};
		case "math_geometry":
			return {
				caption: "Reference geometry sketch for the setup.",
				altText: "A coordinate view with one line segment and labeled endpoints.",
				spec: {
					kind: "math_geometry",
					view: {
						xMin: 0,
						xMax: 10,
						yMin: 0,
						yMax: 10,
						showGrid: true,
						showAxes: true,
					},
					primitives: [
						{
							type: "segment",
							from: { x: 2, y: 2 },
							to: { x: 8, y: 6 },
							label: "AB",
							dashed: null,
							tickMarks: null,
							arrowEnd: null,
						},
					],
				},
			};
		case "chemistry_reaction":
			return {
				caption: "Reference reaction equation scaffold.",
				altText: "A balanced chemical reaction equation shown as text.",
				spec: {
					kind: "chemistry_reaction",
					ce: "2H2 + O2 -> 2H2O",
					label: "Example reaction",
				},
			};
		case "chemistry_molecule":
			return {
				caption: "Reference molecular structure scaffold.",
				altText: "A simple two-dimensional molecule representation.",
				spec: {
					kind: "chemistry_molecule",
					smiles: "O",
					display: "2d",
					label: "Molecule",
				},
			};
		case "accountancy_table":
			return {
				caption: "Reference journal row scaffold.",
				altText: "A journal-style accounting table with one sample row.",
				spec: {
					kind: "accountancy_table",
					subKind: "journal_entry",
					rows: [
						{
							date: "01-04",
							particulars: "Sample entry",
							debit: 100,
							credit: null,
							narration: null,
						},
					],
				},
			};
		case "india_map":
			return {
				caption: "Outline map of India for location reference.",
				altText: "An outline map of India without highlighted states.",
				spec: {
					kind: "india_map",
					mapStyle: "outline",
					highlightedStates: null,
				},
			};
		case "english_passage":
			return {
				caption: "Short passage scaffold for text-based questions.",
				altText: "A one-line numbered excerpt placeholder (replace with real passage in production items).",
				spec: {
					kind: "english_passage",
					title: "Passage",
					source: null,
					lines: [
						{
							number: 1,
							text: "The river slipped quietly past the town, carrying the last light of the evening.",
						},
					],
				},
			};
		case "biology_diagram":
			return {
				caption: "Biology diagram stimulus for labelled-structure reasoning.",
				altText: "A compact biology diagram with labelled parts for the question.",
				spec: {
					kind: "biology_diagram",
					subKind: "pedigree",
					title: "Biology stimulus",
					labels: [
						{ id: "a", text: "A", x: 30, y: 45 },
						{ id: "b", text: "B", x: 70, y: 45 },
					],
					notes: [],
				},
			};
		case "flowchart":
			return {
				caption: "Process flow for the question.",
				altText: "A three-step flowchart showing a start, process, and outcome.",
				spec: {
					kind: "flowchart",
					title: "Process flow",
					nodes: [
						{ id: "start", label: "Start", detail: null, kind: "start" },
						{ id: "process", label: "Process", detail: null, kind: "process" },
						{ id: "outcome", label: "Outcome", detail: null, kind: "outcome" },
					],
					edges: [
						{ from: "start", to: "process", label: null },
						{ from: "process", to: "outcome", label: null },
					],
				},
			};
		case "timeline":
			return {
				caption: "Timeline stimulus for chronological reasoning.",
				altText: "A two-event timeline arranged in chronological order.",
				spec: {
					kind: "timeline",
					title: "Timeline",
					axisLabel: "Chronology",
					events: [
						{ dateLabel: "Stage 1", label: "First event", description: null, emphasis: false },
						{ dateLabel: "Stage 2", label: "Second event", description: null, emphasis: true },
					],
				},
			};
		case "source_extract":
			return {
				caption: "Line-numbered source extract for interpretation.",
				altText: "A short source extract with one numbered line.",
				spec: {
					kind: "source_extract",
					title: "Source extract",
					source: null,
					context: null,
					lines: [{ number: 1, text: "All persons are equal before the law." }],
				},
			};
		case "map_visual":
			return {
				caption: "Map-based stimulus for location reasoning.",
				altText: "A map stimulus listing one highlighted region.",
				spec: {
					kind: "map_visual",
					scope: "india",
					title: "Map stimulus",
					mapStyle: "outline",
					regions: [{ id: "region-a", label: "Region A", role: "highlight" }],
				},
			};
		case "chemistry_cell_diagram":
			return {
				caption: "Electrochemical cell stimulus.",
				altText: "A galvanic cell with zinc anode, copper cathode, salt bridge, and electron flow.",
				spec: {
					kind: "chemistry_cell_diagram",
					cellType: "galvanic",
					anode: { label: "Anode", material: "Zn", electrolyte: "ZnSO4", polarity: "negative" },
					cathode: { label: "Cathode", material: "Cu", electrolyte: "CuSO4", polarity: "positive" },
					saltBridge: "KNO3",
					electronFlow: "anode_to_cathode",
					labels: ["Salt bridge"],
				},
			};
		case "physics_field_diagram":
			return {
				caption: "Field-line diagram stimulus.",
				altText: "An electric field diagram with a positive and a negative charge.",
				spec: {
					kind: "physics_field_diagram",
					fieldType: "electric",
					title: "Electric field",
					sources: [
						{ label: "+Q", kind: "positive_charge", x: 30, y: 50 },
						{ label: "-Q", kind: "negative_charge", x: 70, y: 50 },
					],
					fieldLineCount: 6,
					labels: [],
				},
			};
		case "physics_wave_diagram":
			return {
				caption: "Wave diagram stimulus.",
				altText: "A transverse wave with one labelled marker.",
				spec: {
					kind: "physics_wave_diagram",
					waveType: "transverse",
					title: "Wave",
					xMin: 0,
					xMax: 10,
					amplitude: 1,
					wavelength: 5,
					markers: [{ x: 2.5, label: "Crest" }],
				},
			};
		default:
			return null;
	}
}

/**
 * Picks a fallback envelope for one allowed kind.
 * Graphical kinds require a substantive `visualIdea` (blueprint brief) so we
 * do not spam identical generic diagrams; numeric/table kinds stay grounded.
 */
function pickFallbackCandidateForKind(
	kind: QuestionVisualKind,
	questionText: string,
	strictGrounding: boolean,
	visualIdea: string | null | undefined,
): unknown {
	const ideaTrim = visualIdea?.trim() ?? "";

	if (kind === "data_table") {
		return buildDataTableFallback(questionText);
	}

	if (strictGrounding) {
		if (kind === "number_line") {
			// Skip number_line for 2D coordinate geometry — a 1D axis is misleading there.
			if (COORD_GEOMETRY_2D_RE.test(questionText)) return null;
			return buildNumberLineGroundedFallback(questionText) ?? buildFallbackByKind("number_line", questionText);
		}
		if (kind === "statistics_chart") {
			return (
				buildStatisticsGroundedFallback(questionText) ??
				buildFallbackByKind("statistics_chart", questionText)
			);
		}
		if (kind === "english_passage") {
			return buildFallbackByKind("english_passage", questionText);
		}
	}

	switch (kind) {
		case "physics_diagram":
			return buildPhysicsIdeaAwareEnvelope(questionText, visualIdea);
		case "math_function_plot":
			return buildMathFunctionPlotIdeaAwareEnvelope(questionText, visualIdea);
		case "math_geometry":
			return buildMathGeometryIdeaAwareEnvelope(questionText, visualIdea);
		case "chemistry_molecule":
			return buildChemistryMoleculeIdeaAwareEnvelope(questionText, visualIdea);
		case "chemistry_reaction":
			return buildChemistryReactionIdeaAwareEnvelope(questionText, visualIdea);
		case "biology_diagram":
		case "flowchart":
		case "timeline":
		case "source_extract":
		case "map_visual":
		case "chemistry_cell_diagram":
		case "physics_field_diagram":
		case "physics_wave_diagram": {
			const base = buildFallbackByKind(kind, questionText);
			if (!base) return null;
			if (ideaTrim.length >= 8 && typeof base === "object" && base !== null && "caption" in base) {
				return {
					...(base as QuestionVisualEnvelope),
					caption: shortCaptionFromIdea(ideaTrim, 120),
				};
			}
			return base;
		}
		case "economics_curve":
		case "accountancy_table":
		case "india_map": {
			const base = buildFallbackByKind(kind, questionText);
			if (!base) return null;
			if (ideaTrim.length >= 8 && typeof base === "object" && base !== null && "caption" in base) {
				return {
					...(base as QuestionVisualEnvelope),
					caption: shortCaptionFromIdea(ideaTrim, 120),
				};
			}
			return base;
		}
		default:
			break;
	}

	if (!strictGrounding) {
		// Skip number_line for 2D coordinate geometry even in non-strict mode.
		if (kind === "number_line" && COORD_GEOMETRY_2D_RE.test(questionText)) return null;
		return buildFallbackByKind(kind, questionText);
	}
	return null;
}

export function buildDeterministicFallbackVisual(args: {
	questionText: string;
	preferredKind: QuestionVisualKind | null;
	allowedKinds: QuestionVisualKind[];
	strictGrounding?: boolean;
	/** Blueprint `visual_idea` — required for varied graphical fallbacks. */
	visualIdea?: string | null;
}): QuestionVisualEnvelope | null {
	const strictGrounding = args.strictGrounding === true;
	const orderedKinds: QuestionVisualKind[] = [];
	if (args.preferredKind && args.allowedKinds.includes(args.preferredKind)) {
		orderedKinds.push(args.preferredKind);
	}
	for (const kind of args.allowedKinds) {
		if (!orderedKinds.includes(kind)) orderedKinds.push(kind);
	}
	for (const kind of orderedKinds) {
		const candidate = pickFallbackCandidateForKind(
			kind,
			args.questionText,
			strictGrounding,
			args.visualIdea ?? null,
		);
		if (!candidate) continue;
		const parsed = questionVisualEnvelopeSchema.safeParse(candidate);
		if (parsed.success) return parsed.data;
	}
	return null;
}
