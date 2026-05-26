import "server-only";

import type { PracticeQuestionTypeCounts } from "./constants";
import type {
	PracticeGenerationBlueprintGrouped,
	PracticeGenerationBlueprintSlot,
} from "./practice-generation-blueprint-schema";
import type { QuestionVisualKind } from "./visuals/types";

/**
 * Code-generated stand-in for the LLM blueprint call used by the 3-call
 * pipeline variant (PRACTICE_PIPELINE_VARIANT=3call).
 *
 * Same output shape as the LLM blueprint — BLUEPRINT_SLOTS_JSON still flows
 * into the main-generation prompt verbatim and the "BLUEPRINT CONTRACT" prose
 * still applies. Differences from the LLM version:
 *
 *   - Topic IDs are round-robin'd across slots (no LLM topic-fit reasoning).
 *   - skill_target is a generic placeholder; the main generator picks the
 *     actual skill from topic_grounding context.
 *   - visual_intent is populated from a subject + question-type heuristic
 *     (see `pickVisualIntentForSlot`). We deliberately set needs_visual on
 *     a deterministic share of slots per subject so the downstream visual-
 *     enrichment Flash call (with thinking enabled) has clear candidates,
 *     instead of silently producing zero visuals for whole subjects.
 *
 * Quality watch-out: the visual_idea field is a generic per-subject
 * placeholder. The enrichment Flash call with thinking enabled derives the
 * concrete visual concept from the actual stem.
 */

/**
 * Per-subject fraction of slots that should plan a visual. Picked from
 * subject pedagogy norms — physics word problems lean visual, chemistry
 * bonding/structure problems lean visual, math is mixed (geometry yes,
 * algebra no), language subjects rarely.
 *
 * Numbers are deliberate, not random; the same student + same plan always
 * produces the same blueprint.
 */
const SUBJECT_VISUAL_DENSITY: Array<{ match: RegExp; density: number }> = [
	{ match: /\bphysics\b/i, density: 0.7 },
	{ match: /\bchemistry\b/i, density: 0.45 },
	{ match: /\bbiology\b/i, density: 0.5 },
	// Accounting / Accountancy: most CBSE chapters revolve around ledgers,
	// journals, trial balances, T-accounts — tabular visuals lift quality
	// substantially. Higher density than economics for this reason.
	{ match: /\b(accountanc|accounting)\b/i, density: 0.55 },
	{ match: /\bmath(s|ematics)?\b/i, density: 0.4 },
	{ match: /\b(social|history|geography|civics|polity|economics)\b/i, density: 0.35 },
	{ match: /\b(english|hindi|language|literature)\b/i, density: 0.1 },
];

function densityForSubject(subjectName: string): number {
	for (const { match, density } of SUBJECT_VISUAL_DENSITY) {
		if (match.test(subjectName)) return density;
	}
	return 0.3;
}

/**
 * Per-subject default visual kind preference. Used when the blueprint must
 * commit to ONE preferred_kind per slot before the stem exists. The
 * enrichment Flash call can still override this when the stem clearly
 * suggests something else (e.g. a chemistry stem about gas laws naturally
 * produces a graph, not a molecular structure).
 *
 * Returns the first preferred_kind from the test's policy that matches the
 * subject default; falls back to the first item in preferredKinds if no
 * subject preference is available.
 */
function pickPreferredKindForSubject(
	subjectName: string,
	preferredKinds: readonly QuestionVisualKind[],
): QuestionVisualKind | null {
	if (preferredKinds.length === 0) return null;
	const allowed = new Set<string>(preferredKinds);
	const subjectPrefs: Record<string, QuestionVisualKind[]> = {
		physics: [
			"physics_diagram",
			"physics_field_diagram",
			"physics_wave_diagram",
			"math_geometry",
			"number_line",
			"data_table",
		],
		chemistry: [
			"chemistry_molecule",
			"chemistry_reaction",
			"chemistry_cell_diagram",
			"data_table",
			"math_geometry",
		],
		biology: ["biology_diagram", "flowchart", "data_table"],
		math: ["math_geometry", "math_function_plot", "number_line"],
		mathematics: ["math_geometry", "math_function_plot", "number_line"],
		// Commerce subjects: accountancy leans on `accountancy_table` for
		// ledgers / journals / balance-sheet questions; economics on
		// `economics_curve` for supply-demand and indifference-curve items,
		// falling back to statistics_chart for time-series data.
		accountancy: ["accountancy_table", "data_table", "flowchart"],
		accounting: ["accountancy_table", "data_table", "flowchart"],
		economics: ["economics_curve", "statistics_chart", "data_table"],
	};
	const key = Object.keys(subjectPrefs).find((k) => new RegExp(`\\b${k}\\b`, "i").test(subjectName));
	if (key) {
		for (const k of subjectPrefs[key]!) {
			if (allowed.has(k as string)) return k;
		}
	}
	return preferredKinds[0]!;
}

/**
 * Per-subject placeholder for `visual_intent.visual_idea`. Required to be
 * ≥8 chars by `validatePracticeGenerationBlueprint` when needs_visual=true.
 * The enrichment Flash call (with thinking enabled) will derive the actual
 * concrete visual from the stem; this placeholder is just enough to satisfy
 * the schema and give the model a directional hint.
 */
function visualIdeaPlaceholderForSubject(subjectName: string): string {
	if (/\bphysics\b/i.test(subjectName)) {
		return "Scene or free-body diagram illustrating the physical setup described in the stem.";
	}
	if (/\bchemistry\b/i.test(subjectName)) {
		return "Structural formula, molecular orbital sketch, or labelled diagram for the species in the stem.";
	}
	if (/\bbiology\b/i.test(subjectName)) {
		return "Anatomical or process diagram supporting the biological concept asked.";
	}
	if (/\b(accountanc|accounting)\b/i.test(subjectName)) {
		return "Ledger / journal / T-account / balance-sheet table built from the figures in the stem.";
	}
	if (/\beconomics\b/i.test(subjectName)) {
		return "Supply-demand, indifference, or production curve / chart depicting the relationship in the stem.";
	}
	if (/\bmath(s|ematics)?\b/i.test(subjectName)) {
		return "Geometric or coordinate figure illustrating the configuration described in the stem.";
	}
	return "Figure supporting the concept asked, derived from the stem context.";
}

export function buildDeterministicPracticeBlueprint(args: {
	expectedTypeCounts: PracticeQuestionTypeCounts;
	topicIds: readonly string[];
	difficulty: "easy" | "medium" | "hard";
	subjectName: string;
	visualsEnabled: boolean;
	preferredKinds: readonly QuestionVisualKind[];
}): PracticeGenerationBlueprintGrouped {
	const { expectedTypeCounts, topicIds, difficulty, subjectName, visualsEnabled, preferredKinds } = args;
	if (topicIds.length === 0) {
		throw new Error("buildDeterministicPracticeBlueprint requires at least one topicId.");
	}

	const totalSlots =
		expectedTypeCounts.multiple_choice +
		expectedTypeCounts.fill_in_blank +
		expectedTypeCounts.short_answer +
		expectedTypeCounts.long_answer;

	// Round-robin topic_ids across the *flattened* MCQ→FIB→SA→LA order so the
	// distribution matches what the existing buildPracticeRoundRobinFlatIndexMap
	// later expects — keeps validation / repair diagnostics intact.
	const topicCycle: string[] = [];
	for (let i = 0; i < totalSlots; i++) {
		topicCycle.push(topicIds[i % topicIds.length]!);
	}

	// Visual policy gating: when visuals are disabled at the test level or no
	// preferred_kinds are configured, force visual_intent = null for every
	// slot. The downstream enrichment pass never runs in that case anyway.
	const policyOn = visualsEnabled && preferredKinds.length > 0;
	const density = policyOn ? densityForSubject(subjectName) : 0;
	const visualSlotCount = Math.round(totalSlots * density);

	// Deterministic: the *first* N slots (in flat MCQ→FIB→SA→LA order) get
	// visual_intent populated. This nudges the main generator to write those
	// stems in a visual-friendly way (per the BLUEPRINT CONTRACT prose), and
	// gives the enrichment Flash call a clear set of candidates to work on.
	//
	// We don't randomise because deterministic blueprints should be replayable.
	// The first-N choice biases visuals toward MCQ slots (which are emitted
	// first), which matches CBSE / NCERT exam patterns where MCQs are the
	// most visual-dependent type.
	const visualSlotIndexes = new Set<number>();
	for (let i = 0; i < visualSlotCount; i++) visualSlotIndexes.add(i);

	const preferredKind = pickPreferredKindForSubject(subjectName, preferredKinds);
	const visualIdea = visualIdeaPlaceholderForSubject(subjectName);

	let slotOrder = 0;
	const newSlot = (
		type:
			| "multiple_choice"
			| "fill_in_blank"
			| "short_answer"
			| "long_answer",
	): PracticeGenerationBlueprintSlot => {
		const index = slotOrder++;
		const needsVisual = policyOn && visualSlotIndexes.has(index) && preferredKind != null;
		return {
			slot_id: `slot_${type}_${index + 1}`,
			topic_id: topicCycle[index]!,
			difficulty_level: difficulty,
			skill_target: "Apply core concepts from the topic to a fresh problem.",
			evidence_refs: [],
			question_type: type,
			visual_intent:
				needsVisual ?
					{
						needs_visual: true,
						priority: "high",
						preferred_kind: preferredKind,
						reason: "Subject heuristic suggests a visual supports the assessed skill.",
						visual_idea: visualIdea,
						required: true,
						purpose: "Support the question stem with a directly-relevant figure or scheme.",
					}
				:	null,
		} as PracticeGenerationBlueprintSlot;
	};

	const mcq: PracticeGenerationBlueprintSlot[] = [];
	const fib: PracticeGenerationBlueprintSlot[] = [];
	const sa: PracticeGenerationBlueprintSlot[] = [];
	const la: PracticeGenerationBlueprintSlot[] = [];

	for (let i = 0; i < expectedTypeCounts.multiple_choice; i++) mcq.push(newSlot("multiple_choice"));
	for (let i = 0; i < expectedTypeCounts.fill_in_blank; i++) fib.push(newSlot("fill_in_blank"));
	for (let i = 0; i < expectedTypeCounts.short_answer; i++) sa.push(newSlot("short_answer"));
	for (let i = 0; i < expectedTypeCounts.long_answer; i++) la.push(newSlot("long_answer"));

	return {
		slots_by_type: {
			multiple_choice: mcq as never,
			fill_in_blank: fib as never,
			short_answer: sa as never,
			long_answer: la as never,
		},
		notes: `Deterministic blueprint (PRACTICE_PIPELINE_VARIANT=3call). subject=${subjectName} density=${density} visualSlots=${visualSlotCount}/${totalSlots}.`,
	};
}
