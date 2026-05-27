import type { PracticeQuestionTypeCounts } from "./constants";
import type { PracticeDifficulty } from "./types";
import type { PracticeGenerationBatch } from "./practice-generation-batches";

/**
 * Per-batch budgets that the V2 BATCH CONTRACT stamps directly into the
 * model's prompt — these override the test-wide HARD GATES for the call
 * since the parallel-batched schema enforces only the batch's slice.
 *
 * Time-sum band is computed from the test's per-bucket targets (mirrors
 * `computePerBucketTimeTargets` in system-prompt.ts) scaled by batch size
 * with the same ±20% headroom the test-wide gate uses (60%-120% of target).
 *
 * Cognitive-demand caps mirror the test-wide ratios from
 * `buildSubjectDisciplineBlock`, applied to the batch's slot count, rounded
 * up so the floor stays achievable for tiny batches.
 */
export type PracticeBatchBudget = {
	/** Sum of `estimated_time_seconds` in the batch output must lie in [min, max]. */
	timeSumMin: number;
	timeSumMax: number;
	timeTarget: number;
	/** At MOST this many slots may carry cognitive_demand="Remember". */
	rememberCap: number;
	/** At LEAST this many slots must carry Apply/Analyze/Evaluate/Create. */
	applyFloor: number;
	/** Per-item rough target (seconds) — what each slot's estimated_time_seconds should hover near. */
	perItemTarget: number;
};

const BUCKET_TIME_WEIGHTS = {
	multiple_choice: 1,
	fill_in_blank: 0.85,
	short_answer: 3,
	long_answer: 6,
} as const;

function targetSecondsPerSlot(
	timeLimitSeconds: number,
	counts: PracticeQuestionTypeCounts,
	label: PracticeGenerationBatch["label"],
): number {
	const totalWeight =
		counts.multiple_choice * BUCKET_TIME_WEIGHTS.multiple_choice +
		counts.fill_in_blank * BUCKET_TIME_WEIGHTS.fill_in_blank +
		counts.short_answer * BUCKET_TIME_WEIGHTS.short_answer +
		counts.long_answer * BUCKET_TIME_WEIGHTS.long_answer;
	const fallback: Record<PracticeGenerationBatch["label"], number> = {
		mcq: 60,
		mcq_math: 90,
		fib: 45,
		sa: 180,
		la: 360,
	};
	if (totalWeight <= 0) return fallback[label];
	const perWeight = timeLimitSeconds / totalWeight;
	switch (label) {
		case "mcq":
		case "mcq_math":
			return Math.max(20, Math.round(perWeight * BUCKET_TIME_WEIGHTS.multiple_choice));
		case "fib":
			return Math.max(20, Math.round(perWeight * BUCKET_TIME_WEIGHTS.fill_in_blank));
		case "sa":
			return Math.max(60, Math.round(perWeight * BUCKET_TIME_WEIGHTS.short_answer));
		case "la":
			return Math.max(120, Math.round(perWeight * BUCKET_TIME_WEIGHTS.long_answer));
	}
}

function rememberCapRatio(difficulty: PracticeDifficulty, label: PracticeGenerationBatch["label"]): number {
	if (label === "sa" || label === "la") return 0; // SA never Remember; LA never Remember/Understand.
	if (label === "fib") return difficulty === "easy" ? 0.5 : difficulty === "medium" ? 0.3 : 0.15;
	// mcq / mcq_math
	return difficulty === "easy" ? 0.3 : difficulty === "medium" ? 0.15 : 0.05;
}

function applyFloorRatio(difficulty: PracticeDifficulty, label: PracticeGenerationBatch["label"]): number {
	if (label === "la") return 1; // every LA must be Apply or higher
	if (label === "sa") return 0.75;
	if (label === "fib") return difficulty === "hard" ? 0.5 : 0.25;
	// mcq / mcq_math
	return difficulty === "easy" ? 0.3 : difficulty === "medium" ? 0.5 : 0.65;
}

export function computePracticeBatchBudget(args: {
	batch: PracticeGenerationBatch;
	timeLimitSeconds: number;
	testTypeCounts: PracticeQuestionTypeCounts;
	difficulty: PracticeDifficulty;
}): PracticeBatchBudget {
	const { batch, timeLimitSeconds, testTypeCounts, difficulty } = args;
	const perItemTarget = targetSecondsPerSlot(timeLimitSeconds, testTypeCounts, batch.label);
	const target = perItemTarget * batch.slots.length;
	const min = Math.max(20, Math.round(target * 0.6));
	const max = Math.round(target * 1.2);
	const rememberCap = Math.floor(batch.slots.length * rememberCapRatio(difficulty, batch.label));
	const applyFloor = Math.ceil(batch.slots.length * applyFloorRatio(difficulty, batch.label));
	return {
		timeSumMin: min,
		timeSumMax: max,
		timeTarget: target,
		rememberCap,
		applyFloor,
		perItemTarget,
	};
}

/**
 * Format the budget as the human-readable lines the BATCH CONTRACT injects
 * into the model's prompt. Plain English, tight, one rule per line.
 */
export function formatPracticeBatchBudget(budget: PracticeBatchBudget, slotCount: number): string[] {
	return [
		`Time budget for THIS batch: SUM(estimated_time_seconds) over your ${slotCount} item(s) MUST lie in [${budget.timeSumMin}, ${budget.timeSumMax}] (target ~${budget.timeTarget}; ~${budget.perItemTarget}s per item).`,
		`Cognitive-demand budget for THIS batch: at MOST ${budget.rememberCap} item(s) may carry cognitive_demand="Remember"; at LEAST ${budget.applyFloor} item(s) MUST carry Apply, Analyze, Evaluate, or Create.`,
	];
}
