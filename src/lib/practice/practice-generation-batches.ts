import type { PracticeGenerationBlueprintSlot } from "@/lib/practice/practice-generation-blueprint-schema";
import type { PracticeQuestionTypeCounts } from "@/lib/practice/constants";
import type { PracticeGenerationGroupedOutput } from "@/lib/practice/generation-schema";

/**
 * Plan for one batch in the parallel-batched generation pipeline. The slot
 * indexes are positions in the FULL test's flattened blueprint array so the
 * BATCH CONTRACT can tell the model "you're producing slots [10..12] of 15".
 */
export type PracticeGenerationBatch = {
	/** 0-based batch index. Used in step keys and BATCH CONTRACT tail. */
	index: 0 | 1 | 2 | 3;
	/** Stable label for telemetry / logging. */
	label: "mcq" | "fib" | "sa" | "la" | "mcq_math";
	/** Per-type counts for this batch's structured-output schema. Sums to slots.length. */
	typeCounts: PracticeQuestionTypeCounts;
	/** Blueprint slots assigned to this batch, in flat-array order. */
	slots: PracticeGenerationBlueprintSlot[];
	/** Position of each slot in the FULL test's flat array. */
	slotIndexes: number[];
};

function zeroCounts(): PracticeQuestionTypeCounts {
	return { multiple_choice: 0, fill_in_blank: 0, short_answer: 0, long_answer: 0 };
}

function totalCount(counts: PracticeQuestionTypeCounts): number {
	return counts.multiple_choice + counts.fill_in_blank + counts.short_answer + counts.long_answer;
}

/**
 * Split a math-subject all-MCQ plan into four roughly equal MCQ batches.
 * Floor-distributes the total across four buckets; remainder lands on the
 * earlier batches so batch sizes are non-decreasing as index decreases.
 */
function splitMathPlan(
	slots: PracticeGenerationBlueprintSlot[],
	totalMcq: number,
): PracticeGenerationBatch[] {
	const base = Math.floor(totalMcq / 4);
	const remainder = totalMcq - base * 4;
	const sizes = [
		base + (remainder > 0 ? 1 : 0),
		base + (remainder > 1 ? 1 : 0),
		base + (remainder > 2 ? 1 : 0),
		base,
	];
	const batches: PracticeGenerationBatch[] = [];
	let cursor = 0;
	for (let i = 0; i < 4; i++) {
		const size = sizes[i]!;
		const sliceSlots = slots.slice(cursor, cursor + size);
		const slotIndexes = Array.from({ length: size }, (_, k) => cursor + k);
		batches.push({
			index: i as 0 | 1 | 2 | 3,
			label: "mcq_math",
			typeCounts: { ...zeroCounts(), multiple_choice: size },
			slots: sliceSlots,
			slotIndexes,
		});
		cursor += size;
	}
	return batches;
}

/**
 * Split the flat blueprint slot array into four batches by question type:
 * batch 0 = MCQ, batch 1 = FIB, batch 2 = SA, batch 3 = LA. Math subjects
 * (all-MCQ plan) split into four roughly equal MCQ batches instead.
 *
 * The flat array must come from {@link flattenPracticeGenerationBlueprint},
 * which guarantees order `[mcq..., fib..., sa..., la...]`. We do not re-sort
 * inside the batch — the model receives slots in the same order they appear in
 * the full test.
 *
 * Splitting SA and LA into separate batches (vs. the original 3-batch
 * `text` bucket) cuts the critical-path floor because LA generation is the
 * slowest per-question content type. With 4 batches the wall-clock is
 * bounded by `max(MCQ, FIB, SA, LA)` where LA is typically only 2 questions.
 */
export function splitPracticeQuestionPlanIntoBatches(args: {
	plan: PracticeQuestionTypeCounts;
	slots: PracticeGenerationBlueprintSlot[];
}): PracticeGenerationBatch[] {
	const { plan, slots } = args;
	const total = totalCount(plan);
	if (slots.length !== total) {
		throw new Error(
			`splitPracticeQuestionPlanIntoBatches: slots.length (${slots.length}) does not match plan total (${total}).`,
		);
	}

	const isMathPlan =
		plan.multiple_choice === total &&
		plan.fill_in_blank === 0 &&
		plan.short_answer === 0 &&
		plan.long_answer === 0;
	if (isMathPlan) return splitMathPlan(slots, total);

	const mcqEnd = plan.multiple_choice;
	const fibEnd = mcqEnd + plan.fill_in_blank;
	const saEnd = fibEnd + plan.short_answer;
	const laEnd = saEnd + plan.long_answer;

	const mcqSlots = slots.slice(0, mcqEnd);
	const fibSlots = slots.slice(mcqEnd, fibEnd);
	const saSlots = slots.slice(fibEnd, saEnd);
	const laSlots = slots.slice(saEnd, laEnd);

	const batches: PracticeGenerationBatch[] = [
		{
			index: 0,
			label: "mcq",
			typeCounts: { ...zeroCounts(), multiple_choice: plan.multiple_choice },
			slots: mcqSlots,
			slotIndexes: Array.from({ length: mcqSlots.length }, (_, k) => k),
		},
		{
			index: 1,
			label: "fib",
			typeCounts: { ...zeroCounts(), fill_in_blank: plan.fill_in_blank },
			slots: fibSlots,
			slotIndexes: Array.from({ length: fibSlots.length }, (_, k) => mcqEnd + k),
		},
		{
			index: 2,
			label: "sa",
			typeCounts: { ...zeroCounts(), short_answer: plan.short_answer },
			slots: saSlots,
			slotIndexes: Array.from({ length: saSlots.length }, (_, k) => fibEnd + k),
		},
		{
			index: 3,
			label: "la",
			typeCounts: { ...zeroCounts(), long_answer: plan.long_answer },
			slots: laSlots,
			slotIndexes: Array.from({ length: laSlots.length }, (_, k) => saEnd + k),
		},
	];
	return batches;
}

/** Render `{multiple_choice: 5, fill_in_blank: 0, ...}` as `multiple_choice ×5`. */
function formatBatchTypeCounts(counts: PracticeQuestionTypeCounts): string {
	const parts: string[] = [];
	if (counts.multiple_choice > 0) parts.push(`multiple_choice ×${counts.multiple_choice}`);
	if (counts.fill_in_blank > 0) parts.push(`fill_in_blank ×${counts.fill_in_blank}`);
	if (counts.short_answer > 0) parts.push(`short_answer ×${counts.short_answer}`);
	if (counts.long_answer > 0) parts.push(`long_answer ×${counts.long_answer}`);
	return parts.join(", ");
}

/**
 * Build the per-batch tail appended to the shared user prompt. The shared
 * user-message JSON body (topic_grounding, exercise_chunks, question_bank_chunks)
 * is the big input chunk that DeepSeek's prefix cache hits on — keeping the
 * tail at the very end of the prompt preserves that.
 *
 * The first line ("BLUEPRINT_SLOTS_JSON:") matches the single-call path so the
 * existing BLUEPRINT CONTRACT in the system prompt continues to apply per-slot
 * inside the batch; the model receives only the slots it should produce.
 */
export function buildBatchUserPromptTail(args: {
	batch: PracticeGenerationBatch;
	totalBatches: number;
	totalQuestionsInTest: number;
}): string {
	const { batch, totalBatches, totalQuestionsInTest } = args;
	const firstIdx = batch.slotIndexes[0] ?? 0;
	const lastIdx = batch.slotIndexes[batch.slotIndexes.length - 1] ?? 0;
	const positionRange =
		batch.slotIndexes.length === 1 ?
			`position ${firstIdx}`
		:	`positions ${firstIdx}..${lastIdx}`;
	return [
		"BLUEPRINT_SLOTS_JSON:",
		JSON.stringify(batch.slots),
		"",
		"## BATCH CONTRACT (required)",
		`This is batch ${batch.index + 1} of ${totalBatches} in a parallel-batched generation.`,
		`Produce ONLY the ${batch.slots.length} slot(s) listed in BLUEPRINT_SLOTS_JSON above.`,
		`This batch covers: ${formatBatchTypeCounts(batch.typeCounts)}.`,
		`These slots correspond to ${positionRange} of the full ${totalQuestionsInTest}-question test.`,
		"Do NOT generate questions of any other type. The structured-output schema enforces a count of 0 for every type not listed in this batch.",
		"Keep `questions_by_type` arrays empty for any type with count 0.",
	].join("\n");
}

/**
 * Concatenate per-batch grouped outputs into a single grouped output matching
 * the full test plan. The merge preserves the per-type bucket order produced
 * by the batch schemas (each batch fills exactly one or two buckets).
 *
 * `generation_metadata.adaptation_rationale` is joined from non-empty batch
 * rationales; if all batches return empty strings the result is empty too.
 */
export function mergePracticeBatchOutputs(
	batchOutputs: PracticeGenerationGroupedOutput[],
): PracticeGenerationGroupedOutput {
	const merged: PracticeGenerationGroupedOutput = {
		questions_by_type: {
			multiple_choice: [],
			fill_in_blank: [],
			short_answer: [],
			long_answer: [],
		},
		generation_metadata: { adaptation_rationale: "" },
	};
	const rationales: string[] = [];
	for (const out of batchOutputs) {
		merged.questions_by_type.multiple_choice.push(
			...out.questions_by_type.multiple_choice,
		);
		merged.questions_by_type.fill_in_blank.push(
			...out.questions_by_type.fill_in_blank,
		);
		merged.questions_by_type.short_answer.push(
			...out.questions_by_type.short_answer,
		);
		merged.questions_by_type.long_answer.push(...out.questions_by_type.long_answer);
		const r = out.generation_metadata?.adaptation_rationale?.trim();
		if (r) rationales.push(r);
	}
	merged.generation_metadata.adaptation_rationale = rationales.join(" — ");
	return merged;
}
