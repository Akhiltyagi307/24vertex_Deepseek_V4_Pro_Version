import type { PracticeGenerationBatch } from "./practice-generation-batches";
import {
	formatPracticeBatchBudget,
	type PracticeBatchBudget,
} from "./practice-generation-batch-budget";
import {
	stringifySisterBrief,
	type PracticeBatchSisterBrief,
} from "./practice-generation-batch-sister-brief";

/**
 * Per-batch BLUEPRINT CONTRACT + BATCH CONTRACT + SISTER_BATCHES_BRIEF tail.
 *
 * Replaces the type-agnostic `buildBatchUserPromptTail` for the V2 path. Each
 * batch gets a contract specialised by question type so the blueprint's rich
 * fields (`skill_target`, `evidence_refs`, `visual_intent.reason`,
 * `visual_intent.purpose`) become load-bearing instructions rather than
 * decoration sitting inside BLUEPRINT_SLOTS_JSON.
 */

const SHARED_CONTRACT_PROLOGUE = `## BLUEPRINT CONTRACT for this batch (required)
- Output order MUST match BLUEPRINT_SLOTS_JSON order. Index i of your output corresponds to slot i of the JSON below — easier slots first, harder slots last.
- For each slot, COPY topic_id verbatim from the slot's topic_id field. Do NOT type a UUID from memory.
- The question MUST assess the slot's skill_target precisely. The first Bloom verb of skill_target is the cognitive level you must hit — do not downgrade Apply to Recall, do not upgrade Define to Analyze.
- Set difficulty_level equal to slot.difficulty_level unless a safety/validation constraint forces a one-step adjustment.
- Use evidence_refs as your concrete grounding: for each ref id listed, draw the corresponding entry in topic_grounding for that topic and reuse its numbers / labels / scenario shape. Refereed evidence is foreground; non-refereed chunks are background only.
- Emit visual: null on every question in THIS batch. Visual enrichment runs separately. You MAY write the stem in a visual-friendly way (e.g. "the diagram below shows…") for slots whose visual_intent.needs_visual was true, but the stem MUST stay solvable from text alone — a later pass will attach the figure.`;

const MCQ_CONTRACT = `## MCQ-specific instructions (every slot in this batch)
- The blueprint slot's visual_intent.reason names the ONE misconception or trap the four distractors must exploit (e.g. "trap: mg-sin vs mg-cos", "sign error on transposition", "confused workforce share with GDP share"). When present:
  - Your COMMON-ERROR distractor MUST realise that exact misconception.
  - distractor_rationale.<letter> for the COMMON-ERROR option MUST name the misconception in plain language and tie it back to the slot's reason.
- Populate distractor_rationale for ALL four letters per the four-archetype rubric (CORRECT, COMMON-ERROR, PARTIAL-KNOWLEDGE, SURFACE-PLAUSIBILITY) — no filler.
- ARCHETYPE LABEL DISCIPLINE (REQUIRED — the grader uses these labels for per-option feedback):
  - Exactly ONE of the four distractor_rationale entries may begin with the ALL-CAPS token "CORRECT". That entry MUST be on the letter named in answer_key.correct_answer.
  - The other three entries MUST NOT contain the ALL-CAPS token "CORRECT" anywhere. (Lower-case "correct" inside a longer phrase is fine, e.g. "correctly applied".)
  - Each of the three remaining archetypes (COMMON-ERROR, PARTIAL-KNOWLEDGE, SURFACE-PLAUSIBILITY) must appear exactly once across the three distractor entries — no duplicates, no archetype omitted.
- Distribute correct_answer letters across the batch so any single letter holds no more than 40% of the slot count (target: even spread across A/B/C/D).
- No "All of the above" / "None of the above" / "Both A and B".`;

const FIB_CONTRACT = `## fill_in_blank-specific instructions (every slot in this batch)
- The answer must be a SINGLE value, term, or short phrase — not a discussion. If the slot's skill_target names units or form, the answer string must include them.
- Avoid flashcard recall: do NOT key bare glossary words. If skill_target is computational, the answer is a number with units; if classificatory, the answer is a category label with the discriminating property.
- The blueprint slot's visual_intent.reason (when present) names the most common student misanswer — your expected_misanswers MUST include that misanswer with the rationale spelt out, alongside 1-3 other common misanswers.
- estimated_time_seconds for each FIB should reflect a short single-step computation — long working-out belongs in short_answer.`;

const SA_CONTRACT = `## short_answer-specific instructions (every slot in this batch)
- The stem and answer MUST imply a 2-4 step procedure (state given -> set up rule -> compute -> interpret, OR define -> example -> contrast).
- When the blueprint slot's visual_intent.purpose is present, treat it as the ORDERED CHAIN of steps your explanation must follow (read the arrow-separated string left to right; each segment becomes one labelled Step in the explanation).
- Populate marking_points with 3-5 bullets that map 1-to-1 onto those steps so the grader can credit partial work.
- expected_misanswers MUST surface the specific midstep error each step tends to attract (e.g. "Stopped at Step 2: gave intermediate value instead of final answer").
- Use Format A explanations for numerical SAs (one-line answer, given, step-by-step with operation + why); Format B for definition/comparison SAs.`;

const LA_CONTRACT = `## long_answer-specific instructions (every slot in this batch)
- Each LA bundles 2-3 sub-skills. The blueprint slot's visual_intent.purpose is the AUTHORITATIVE sub-skill chain (arrow-separated). Your explanation MUST walk every link in that chain in order; skipping a link is a planning miss.
- marking_points (4-6 bullets, with mark weights when possible) MUST map onto the chain segments so the grader can attribute partial credit segment-by-segment.
- cognitive_demand for every LA in this batch MUST be one of Apply / Analyze / Evaluate / Create. Never Remember, never Understand.
- expected_misanswers (2-4) should target the WHOLE-ITEM common errors: dropped final synthesis step, treated a comparison as a list, missed quantitative grounding required by the chain.
- Format-B explanation style (paragraph + worked numerics inline where required) — keep the length within the difficulty band (medium 180-260 words, hard 220-340 words; do NOT pad).`;

function contractForLabel(label: PracticeGenerationBatch["label"]): string {
	switch (label) {
		case "mcq":
		case "mcq_math":
			return MCQ_CONTRACT;
		case "fib":
			return FIB_CONTRACT;
		case "sa":
			return SA_CONTRACT;
		case "la":
			return LA_CONTRACT;
	}
}

function formatBatchTypeCounts(batch: PracticeGenerationBatch): string {
	const c = batch.typeCounts;
	const parts: string[] = [];
	if (c.multiple_choice > 0) parts.push(`multiple_choice ×${c.multiple_choice}`);
	if (c.fill_in_blank > 0) parts.push(`fill_in_blank ×${c.fill_in_blank}`);
	if (c.short_answer > 0) parts.push(`short_answer ×${c.short_answer}`);
	if (c.long_answer > 0) parts.push(`long_answer ×${c.long_answer}`);
	return parts.join(", ");
}

/**
 * Build the V2 user-prompt tail. Replaces the test-wide HARD GATES for the
 * call: the model is told EXACTLY this batch's counts, time budget, and
 * cognitive-demand allowance, and is given a per-type contract plus a tiny
 * cross-batch brief so it can avoid duplicating the sister batches.
 */
export function buildBatchUserPromptTailV2(args: {
	batch: PracticeGenerationBatch;
	totalBatches: number;
	totalQuestionsInTest: number;
	budget: PracticeBatchBudget;
	sisterBrief: PracticeBatchSisterBrief[];
}): string {
	const { batch, totalBatches, totalQuestionsInTest, budget, sisterBrief } = args;
	const firstIdx = batch.slotIndexes[0] ?? 0;
	const lastIdx = batch.slotIndexes[batch.slotIndexes.length - 1] ?? 0;
	const positionRange =
		batch.slotIndexes.length === 1
			? `position ${firstIdx}`
			: `positions ${firstIdx}..${lastIdx}`;
	const budgetLines = formatPracticeBatchBudget(budget, batch.slots.length);

	const lines = [
		"BLUEPRINT_SLOTS_JSON:",
		JSON.stringify(batch.slots),
		"",
		"SISTER_BATCHES_BRIEF:",
		stringifySisterBrief(sisterBrief),
		"",
		"## BATCH CONTRACT (this OVERRIDES the test-wide HARD GATES in the system prompt for this call)",
		`This is batch ${batch.index + 1} of ${totalBatches} of a parallel-batched generation.`,
		`Produce EXACTLY ${batch.slots.length} ${formatBatchTypeCounts(batch)} item(s). Output 0 of every other type — the schema enforces empty arrays for non-batch types.`,
		`These slots correspond to ${positionRange} of the full ${totalQuestionsInTest}-question test.`,
		...budgetLines.map((l) => `- ${l}`),
		"- The test-wide totals and time-sum band stated in the system prompt's HARD GATES apply to the FULL TEST, not to this call. For THIS call, the budgets immediately above are the binding ones.",
		"- The cross-batch duplicate-stems and uniqueness rules from the system prompt apply across the full test. Use SISTER_BATCHES_BRIEF above to AVOID assigning the same Bloom verb / skill_target / topic-subskill that another batch already covers. When in doubt, pick a DIFFERENT sub-skill within the topic.",
		"",
		SHARED_CONTRACT_PROLOGUE,
		"",
		contractForLabel(batch.label),
	];

	return lines.join("\n");
}
