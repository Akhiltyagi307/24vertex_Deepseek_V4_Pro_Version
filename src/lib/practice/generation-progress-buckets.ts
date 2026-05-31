/**
 * Student-facing progress buckets for practice-test generation.
 *
 * The generation pipeline emits ~15 fine-grained telemetry `stepKey`s (several
 * conditional or looping). For the in-flight progress checklist we collapse them
 * into 5 stable, ordered, monotonic buckets. Shared by the server route (maps
 * raw stepKeys → buckets) and the client overlay (renders the checklist), so
 * this module must stay free of `server-only` and React imports.
 */

export type GenerationChecklistBucket =
	| "topics"
	| "blueprint"
	| "writing"
	| "diagrams"
	| "finishing";

export const GENERATION_BUCKETS: ReadonlyArray<{
	id: GenerationChecklistBucket;
	label: string;
}> = [
	{ id: "topics", label: "Picking your topics" },
	{ id: "blueprint", label: "Planning the test" },
	{ id: "writing", label: "Writing questions" },
	{ id: "diagrams", label: "Adding diagrams" },
	{ id: "finishing", label: "Quality check & finishing up" },
];

export const BUCKET_TOTAL = GENERATION_BUCKETS.length;

/** 1-based position per bucket, for rendering "step i of n" and monotonicity. */
export const BUCKET_INDEX = GENERATION_BUCKETS.reduce<Record<GenerationChecklistBucket, number>>(
	(acc, bucket, i) => {
		acc[bucket.id] = i + 1;
		return acc;
	},
	{} as Record<GenerationChecklistBucket, number>,
);

/** Exact stepKey → bucket. Suffix variants are handled by bucketForStepKey. */
const STEP_KEY_TO_BUCKET: Record<string, GenerationChecklistBucket> = {
	topic_context_fetch: "topics",
	job_context_built: "topics",
	blueprint_generate: "blueprint",
	question_generation: "writing",
	batch_audit: "writing",
	batch_editor: "writing",
	visual_intent_gate: "diagrams",
	visual_enrichment: "diagrams",
	visual_validator: "diagrams",
	post_assembly_validation: "finishing",
	persist_test_rpc: "finishing",
};

/** Looping/conditional stages reuse a base key with one of these suffixes. */
const STRIPPABLE_SUFFIXES = ["_retry", "_recheck", "_fallback", "_recovery"] as const;

/**
 * Map a raw pipeline stepKey to its student-facing bucket, or null if the step
 * isn't surfaced (e.g. `pipeline_failed`, which is handled via the error path).
 */
export function bucketForStepKey(stepKey: string): GenerationChecklistBucket | null {
	const direct = STEP_KEY_TO_BUCKET[stepKey];
	if (direct) return direct;
	for (const suffix of STRIPPABLE_SUFFIXES) {
		if (stepKey.endsWith(suffix)) {
			const mapped = STEP_KEY_TO_BUCKET[stepKey.slice(0, -suffix.length)];
			if (mapped) return mapped;
		}
	}
	return null;
}
