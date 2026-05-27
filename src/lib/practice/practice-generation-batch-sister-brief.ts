import type { PracticeGenerationBatch } from "./practice-generation-batches";
import type { PracticeGenerationBlueprintSlot } from "./practice-generation-blueprint-schema";

/**
 * A short cross-batch summary the V2 BATCH CONTRACT injects so each parallel
 * call knows what its sister batches are planning. Keeps duplicates and
 * Bloom-clustering down without leaking full slot content.
 */
export type PracticeBatchSisterBrief = {
	index: PracticeGenerationBatch["index"];
	label: PracticeGenerationBatch["label"];
	slot_count: number;
	position_range: string;
	topic_ids: string[];
	skill_target_labels: string[];
	bloom_verbs: string[];
};

const BLOOM_VERBS = new Set([
	"recall",
	"identify",
	"define",
	"state",
	"describe",
	"explain",
	"classify",
	"compare",
	"apply",
	"calculate",
	"compute",
	"derive",
	"analyze",
	"justify",
	"evaluate",
	"construct",
	"prove",
]);

/** Pull the Bloom verb from the front of a skill_target, or "—" if absent. */
function bloomVerbOf(skillTarget: string): string {
	const trimmed = skillTarget.trim();
	if (!trimmed) return "—";
	const first = trimmed.split(/[\s,.:;]/, 1)[0]!;
	const lower = first.toLowerCase();
	if (BLOOM_VERBS.has(lower)) return first;
	return "—";
}

/**
 * Truncate a skill_target down to the first 60 chars for the cross-batch
 * brief so the sister payload stays tiny. The full skill_target stays inside
 * each batch's own BLUEPRINT_SLOTS_JSON.
 */
function shortLabel(skillTarget: string): string {
	const oneLine = skillTarget.replace(/\s+/g, " ").trim();
	return oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine;
}

function positionRange(batch: PracticeGenerationBatch): string {
	const first = batch.slotIndexes[0] ?? 0;
	const last = batch.slotIndexes[batch.slotIndexes.length - 1] ?? 0;
	return batch.slotIndexes.length === 1 ? `pos ${first}` : `pos ${first}-${last}`;
}

function describeBatch(batch: PracticeGenerationBatch): PracticeBatchSisterBrief {
	const topicIds = batch.slots.map((s) => s.topic_id);
	const skill_target_labels = batch.slots.map((s) => shortLabel(s.skill_target));
	const bloom_verbs = batch.slots.map((s) => bloomVerbOf(s.skill_target));
	return {
		index: batch.index,
		label: batch.label,
		slot_count: batch.slots.length,
		position_range: positionRange(batch),
		topic_ids: topicIds,
		skill_target_labels,
		bloom_verbs,
	};
}

/** Build the sister-brief list for every batch *except* `self`. */
export function buildSisterBriefForBatch(args: {
	self: PracticeGenerationBatch;
	allBatches: PracticeGenerationBatch[];
}): PracticeBatchSisterBrief[] {
	return args.allBatches
		.filter((b) => b.index !== args.self.index)
		.map((b) => describeBatch(b));
}

/** Pretty-print the sister-brief as the model-facing JSON block. */
export function stringifySisterBrief(sister: PracticeBatchSisterBrief[]): string {
	return JSON.stringify(sister);
}

/** Unique skill_target labels across the full blueprint, for de-dup hints. */
export function uniqueSkillTargetLabels(slots: PracticeGenerationBlueprintSlot[]): string[] {
	const set = new Set<string>();
	for (const s of slots) {
		set.add(shortLabel(s.skill_target).toLowerCase());
	}
	return [...set];
}
