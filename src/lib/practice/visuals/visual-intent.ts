import type { PracticeGenerationOutput } from "../generation-schema";
import type { PracticeGenerationBlueprintSlot } from "../practice-generation-blueprint-schema";
import type { QuestionVisualKind } from "./types";

export type VisualNeedPriority = "necessary" | "high" | "medium" | "none";
export type VisualIntentReason =
	| "explicit_instruction"
	| "spatial_layout"
	| "trend_or_data"
	| "map_or_passage"
	| "process_or_timeline"
	| "gravitation_geometry"
	| "kinematics_components"
	| "work_energy_forces"
	| "chemistry_equilibrium"
	| "chemistry_lewis"
	| "blueprint_intent"
	| "text_sufficient";

export type ResolvedVisualIntentDecision = {
	index: number;
	needsVisual: boolean;
	priority: VisualNeedPriority;
	reason: VisualIntentReason;
	preferredKind: QuestionVisualKind | null;
};

type VisualRound = "initial" | "retry_1" | "retry_2";

const EXPLICIT_VISUAL_CUE_RE =
	/\b(shown below|given below|refer to (the )?(figure|diagram|graph|plot|table|map|passage|timeline|source extract)|from (the )?(figure|diagram|graph|plot|table|map|passage|timeline|source extract)|using (the )?(figure|diagram|graph|plot|table|map|passage|timeline|source extract)|use (the )?(timeline|source extract)|read (the )?(graph|plot|table|map|passage|source extract)|as shown in (the )?(figure|diagram|graph|plot|table|map)|line\s+\d+\s*(?:to|-)\s*\d+)\b/i;
const SPATIAL_LAYOUT_RE =
	/\b(circuit|free body|ray diagram|mirror|lens|prism|inclined plane)\b/i;
const FIELD_OR_WAVE_RE =
	/\b(electric field|magnetic field|field lines|wavefront|standing wave|interference pattern|wavelength|amplitude|node|antinode)\b/i;
const PROCESS_OR_TIMELINE_RE =
	/\b(flowchart|flow chart|process diagram|timeline|chronology|sequence of events)\b/i;
const TREND_OR_DATA_RE =
	/\b(histogram|bar chart|line graph|scatter plot|ogive|frequency table|frequency distribution|box plot|pie chart|demand curve|supply curve|time[- ]series|data table|tabulated data|plot (?:the )?graph|recorded data|observed values|readings?)\b/i;
const RELATIONSHIP_OR_COMPARISON_RE =
	/\b(relationship between|variation of|varies with|compare(?: the)? data|compare the following|observations? (?:are )?(?:shown|given)|at different (?:times|temperatures|prices|distances|speeds)|versus|vs\.)\b/i;
const MAP_OR_PASSAGE_RE =
	/\b(map of india|india map|locate on map|which state is|highlighted state|read the passage|passage below|according to the passage|comprehension passage)\b/i;
const GRAVITATION_GEOMETRY_RE =
	/\b(gravitational acceleration|gravity|surface\s+gravity|escape[-\s]?(speed|velocity)|neutral\s+point|two[-\s]?sphere|earth'?s?\s+(surface|centre|center|radius)|above\s+earth|below\s+earth|inside\s+earth|height\s+h|depth\s+d|halfway\s+(down|to)|radius\s+cubed|speed\s+at\s+infinity|reaches\s+infinity|far\s+away\s+from\s+earth|v_e|r_e\b)\b/i;
const KINEMATICS_COMPONENTS_RE =
	/\b(projectile|trajectory|initial\s+velocity\s+components?|velocity\s+components?|component\s+equations?|constant\s+acceleration\s+in\s+(?:the\s+)?[xy][-\s]?direction|motion\s+in\s+a\s+plane|v_?0?[xy]\b|v_\{0[xy]\}|a_[xy]\b|x[-\s]?motion|y[-\s]?motion|horizontal\s+acceleration|vertical\s+acceleration)\b/i;
const WORK_ENERGY_FORCES_RE =
	/\b(work\s+done|net\s+work|kinetic\s+energy|friction|coefficient\s+of\s+kinetic\s+friction|force\s+and\s+(?:the\s+)?displacement|displacement\s+and\s+(?:the\s+)?force|opposite\s+in\s+direction|same\s+direction|skids?\s+to\s+a\s+stop|applied\s+force)\b/i;
const CHEMISTRY_EQUILIBRIUM_RE =
	/\b(equilibrium|equilibrium\s+constant|k_?c\b|k_?p\b|k_?sp\b|q_?sp\b|solubility\s+product|sparingly\s+soluble|precipitat|common\s+ion|ionic\s+product|⇌|<=>)\b/i;
const CHEMISTRY_LEWIS_RE =
	/\b(lewis\s+(?:symbol|structure|picture|dot)|valence\s+electrons?|lone\s+pairs?|bonding\s+pairs?|octet\s+rule|duplet|shared\s+pair|electron\s+dot)\b/i;

function priorityRank(priority: VisualNeedPriority): number {
	switch (priority) {
		case "necessary":
			return 0;
		case "high":
			return 1;
		case "medium":
			return 2;
		case "none":
		default:
			return 3;
	}
}

function normalizeBlueprintIntent(
	slot: PracticeGenerationBlueprintSlot | null | undefined,
	allowedKinds: QuestionVisualKind[],
): { needsVisual: boolean; priority: VisualNeedPriority; preferredKind: QuestionVisualKind | null } {
	const intent = slot?.visual_intent;
	if (!intent) {
		return {
			needsVisual: false,
			priority: "none",
			preferredKind: null,
		};
	}
	const needsVisual = intent.needs_visual ?? intent.required ?? false;
	let priority: VisualNeedPriority = intent.priority;
	if (!needsVisual) {
		priority = "none";
	} else if (priority === "none") {
		priority = "medium";
	}
	const preferredKind =
		typeof intent.preferred_kind === "string" &&
		allowedKinds.includes(intent.preferred_kind as QuestionVisualKind)
			? (intent.preferred_kind as QuestionVisualKind)
			: null;
	return {
		needsVisual,
		priority,
		preferredKind,
	};
}

function pickPreferredKind(args: {
	allowedKinds: QuestionVisualKind[];
	reason: VisualIntentReason;
	blueprintPreferredKind: QuestionVisualKind | null;
}): QuestionVisualKind | null {
	if (args.blueprintPreferredKind) return args.blueprintPreferredKind;
	const priorityOrder: QuestionVisualKind[] =
		args.reason === "spatial_layout" ?
			[
				"physics_field_diagram",
				"physics_wave_diagram",
				"physics_diagram",
				"biology_diagram",
				"flowchart",
				"math_geometry",
				"number_line",
				"data_table",
				"math_function_plot",
			]
		: args.reason === "kinematics_components" ?
			["math_geometry", "math_function_plot", "physics_diagram", "data_table"]
		: args.reason === "work_energy_forces" ?
			["physics_diagram", "math_geometry", "data_table", "math_function_plot"]
		: args.reason === "chemistry_equilibrium" ?
			["chemistry_reaction", "data_table", "chemistry_molecule"]
		: args.reason === "chemistry_lewis" ?
			["chemistry_molecule", "data_table", "chemistry_reaction"]
		: args.reason === "process_or_timeline" ?
			["timeline", "flowchart", "source_extract", "data_table"]
		: args.reason === "gravitation_geometry" ?
			["math_geometry", "physics_diagram", "math_function_plot", "data_table"]
		: args.reason === "map_or_passage" || args.reason === "explicit_instruction" ?
			[
				"source_extract",
				"timeline",
				"map_visual",
				"india_map",
				"english_passage",
				"flowchart",
				"data_table",
				"statistics_chart",
			]
		: args.reason === "blueprint_intent" ?
			[
				"physics_field_diagram",
				"physics_wave_diagram",
				"chemistry_cell_diagram",
				"biology_diagram",
				"flowchart",
				"timeline",
				"source_extract",
				"map_visual",
				"physics_diagram",
				"math_geometry",
				"math_function_plot",
				"chemistry_molecule",
				"chemistry_reaction",
				"economics_curve",
				"statistics_chart",
				"number_line",
				"india_map",
				"english_passage",
				"accountancy_table",
				"data_table",
			]
		:	[
				"data_table",
				"math_function_plot",
				"statistics_chart",
				"economics_curve",
				"number_line",
				"physics_diagram",
			];
	for (const kind of priorityOrder) {
		if (args.allowedKinds.includes(kind)) return kind;
	}
	return args.allowedKinds[0] ?? null;
}

function inferStemIntent(questionText: string): {
	needsVisual: boolean;
	priority: VisualNeedPriority;
	reason: VisualIntentReason;
} {
	const text = questionText.trim();
	if (text.length === 0) {
		return { needsVisual: false, priority: "none", reason: "text_sufficient" };
	}
	if (FIELD_OR_WAVE_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "spatial_layout" };
	}
	if (PROCESS_OR_TIMELINE_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "process_or_timeline" };
	}
	if (GRAVITATION_GEOMETRY_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "gravitation_geometry" };
	}
	if (KINEMATICS_COMPONENTS_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "kinematics_components" };
	}
	if (WORK_ENERGY_FORCES_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "work_energy_forces" };
	}
	if (CHEMISTRY_EQUILIBRIUM_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "chemistry_equilibrium" };
	}
	if (CHEMISTRY_LEWIS_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "chemistry_lewis" };
	}
	if (EXPLICIT_VISUAL_CUE_RE.test(text)) {
		return { needsVisual: true, priority: "necessary", reason: "explicit_instruction" };
	}
	if (SPATIAL_LAYOUT_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "spatial_layout" };
	}
	if (TREND_OR_DATA_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "trend_or_data" };
	}
	if (RELATIONSHIP_OR_COMPARISON_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "trend_or_data" };
	}
	if (MAP_OR_PASSAGE_RE.test(text)) {
		return { needsVisual: true, priority: "high", reason: "map_or_passage" };
	}
	return { needsVisual: false, priority: "none", reason: "text_sufficient" };
}

export function resolveQuestionVisualIntent(args: {
	questions: PracticeGenerationOutput["questions"];
	blueprintSlots: PracticeGenerationBlueprintSlot[];
	allowedKinds: QuestionVisualKind[];
}): ResolvedVisualIntentDecision[] {
	return args.questions.map((question, index) => {
		const blueprint = normalizeBlueprintIntent(args.blueprintSlots[index], args.allowedKinds);
		const stem = inferStemIntent(question.question_text);

		if (stem.needsVisual) {
			const priority: VisualNeedPriority =
				stem.priority === "necessary" || blueprint.priority === "necessary"
					? "necessary"
					: "high";
			return {
				index,
				needsVisual: true,
				priority,
				reason: stem.reason,
				preferredKind: pickPreferredKind({
					allowedKinds: args.allowedKinds,
					reason: stem.reason,
					blueprintPreferredKind: blueprint.preferredKind,
				}),
			};
		}

		if (blueprint.needsVisual) {
			if (blueprint.priority === "none") {
				return {
					index,
					needsVisual: false,
					priority: "none",
					reason: "text_sufficient",
					preferredKind: null,
				};
			}
			const priority: VisualNeedPriority =
				blueprint.priority === "necessary" ? "necessary"
				: blueprint.priority === "medium" ? "medium"
				: "high";
			return {
				index,
				needsVisual: true,
				priority,
				reason: "blueprint_intent",
				preferredKind: pickPreferredKind({
					allowedKinds: args.allowedKinds,
					reason: "blueprint_intent",
					blueprintPreferredKind: blueprint.preferredKind,
				}),
			};
		}

		return {
			index,
			needsVisual: false,
			priority: "none",
			reason: "text_sufficient",
			preferredKind: null,
		};
	});
}

function selectByPriority(
	nullVisualNeeded: ResolvedVisualIntentDecision[],
	allowed: ReadonlySet<VisualNeedPriority>,
): number[] {
	return [...nullVisualNeeded]
		.filter((decision) => allowed.has(decision.priority))
		.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.index - b.index)
		.map((decision) => decision.index);
}

export function selectVisualCandidateIndexes(args: {
	round: VisualRound;
	questions: PracticeGenerationOutput["questions"];
	decisions: ResolvedVisualIntentDecision[];
}): number[] {
	const nullVisualNeeded = args.decisions.filter((decision) => {
		const question = args.questions[decision.index];
		return decision.needsVisual && question?.visual == null;
	});
	if (nullVisualNeeded.length === 0) return [];

	if (args.round === "initial") {
		const necessary = selectByPriority(nullVisualNeeded, new Set(["necessary"]));
		if (necessary.length > 0) return necessary;
		const high = selectByPriority(nullVisualNeeded, new Set(["high"]));
		if (high.length > 0) return high;
		return selectByPriority(nullVisualNeeded, new Set(["medium"]));
	}

	if (args.round === "retry_1") {
		return selectByPriority(nullVisualNeeded, new Set(["necessary", "high"]));
	}

	return selectByPriority(nullVisualNeeded, new Set(["necessary", "high", "medium"]));
}

export function summarizeVisualIntentDecisions(
	decisions: ResolvedVisualIntentDecision[],
): Record<string, number> {
	const counts = {
		total: decisions.length,
		needs_visual_true: 0,
		priority_necessary: 0,
		priority_high: 0,
		priority_medium: 0,
		priority_none: 0,
	};
	for (const decision of decisions) {
		if (decision.needsVisual) counts.needs_visual_true += 1;
		if (decision.priority === "necessary") counts.priority_necessary += 1;
		if (decision.priority === "high") counts.priority_high += 1;
		if (decision.priority === "medium") counts.priority_medium += 1;
		if (decision.priority === "none") counts.priority_none += 1;
	}
	return counts;
}

export function shouldRequireAtLeastOneVisual(
	candidateIndexes: number[],
	decisions: ResolvedVisualIntentDecision[],
): boolean {
	return candidateIndexes.some((index) => {
		const priority = decisions[index]?.priority;
		return priority === "necessary" || priority === "high";
	});
}
