import { z } from "zod";

import type { PracticeQuestionTypeCounts } from "./constants";
import type { QuestionVisualKind } from "./visuals/types";

const difficultySchema = z.enum(["easy", "medium", "hard"]);
const visualPrioritySchema = z.enum(["necessary", "high", "medium", "none"]);

const visualIntentSchema = z.object({
	needs_visual: z.boolean(),
	priority: visualPrioritySchema,
	preferred_kind: z.string().max(48).nullable(),
	reason: z.string().max(80).nullable(),
	/**
	 * Concrete brief for what the figure should depict (axes, layout, apparatus,
	 * curve family, table role, map focus, etc.). Required when `needs_visual`
	 * is true and visuals are enabled — validated in `validatePracticeGenerationBlueprint`.
	 */
	visual_idea: z.string().max(420).nullable(),
	// Backward-compatible mirrors while prompts and telemetry migrate.
	required: z.boolean().nullable(),
	purpose: z.string().max(240).nullable(),
});

export type PracticeBlueprintVisualPolicy = {
	enabled: boolean;
	preferredKinds: readonly QuestionVisualKind[];
};

const blueprintSlotBaseSchema = z.object({
	slot_id: z.string().min(1).max(32),
	topic_id: z.string().uuid(),
	difficulty_level: difficultySchema,
	skill_target: z.string().min(1).max(280),
	evidence_refs: z.array(z.string().min(1).max(96)).max(8),
	visual_intent: visualIntentSchema.nullable(),
});

const blueprintMcqSlotSchema = blueprintSlotBaseSchema.extend({
	question_type: z.literal("multiple_choice"),
});
const blueprintFibSlotSchema = blueprintSlotBaseSchema.extend({
	question_type: z.literal("fill_in_blank"),
});
const blueprintShortSlotSchema = blueprintSlotBaseSchema.extend({
	question_type: z.literal("short_answer"),
});
const blueprintLongSlotSchema = blueprintSlotBaseSchema.extend({
	question_type: z.literal("long_answer"),
});

export function createPracticeGenerationBlueprintSchema(expectedTypeCounts: PracticeQuestionTypeCounts) {
	return z.object({
		slots_by_type: z.object({
			multiple_choice: z
				.array(blueprintMcqSlotSchema)
				.length(expectedTypeCounts.multiple_choice),
			fill_in_blank: z
				.array(blueprintFibSlotSchema)
				.length(expectedTypeCounts.fill_in_blank),
			short_answer: z.array(blueprintShortSlotSchema).length(expectedTypeCounts.short_answer),
			long_answer: z.array(blueprintLongSlotSchema).length(expectedTypeCounts.long_answer),
		}),
		notes: z.string().max(600).nullable(),
	});
}

export type PracticeGenerationBlueprintGrouped = z.infer<
	ReturnType<typeof createPracticeGenerationBlueprintSchema>
>;

export type PracticeGenerationBlueprintSlot = z.infer<
	| typeof blueprintMcqSlotSchema
	| typeof blueprintFibSlotSchema
	| typeof blueprintShortSlotSchema
	| typeof blueprintLongSlotSchema
>;

export function flattenPracticeGenerationBlueprint(
	blueprint: PracticeGenerationBlueprintGrouped,
): PracticeGenerationBlueprintSlot[] {
	return [
		...blueprint.slots_by_type.multiple_choice,
		...blueprint.slots_by_type.fill_in_blank,
		...blueprint.slots_by_type.short_answer,
		...blueprint.slots_by_type.long_answer,
	];
}

function normalizeTopicIdForMatch(topicId: string): string {
	return topicId.replaceAll("-", "").toLowerCase();
}

function hammingDistance(left: string, right: string): number {
	if (left.length !== right.length) return Number.POSITIVE_INFINITY;
	let distance = 0;
	for (let i = 0; i < left.length; i++) {
		if (left[i] !== right[i]) distance++;
	}
	return distance;
}

function findUniqueNearTopicIdMatch(topicId: string, allowedTopicIds: Set<string>): string | null {
	const normalizedTopicId = normalizeTopicIdForMatch(topicId);
	const matches = [...allowedTopicIds].filter(
		(allowedId) => hammingDistance(normalizeTopicIdForMatch(allowedId), normalizedTopicId) === 1,
	);
	return matches.length === 1 ? matches[0]! : null;
}

export function validatePracticeGenerationBlueprint(args: {
	blueprint: PracticeGenerationBlueprintGrouped;
	allowedTopicIds: Set<string>;
	expectedTypeCounts: PracticeQuestionTypeCounts;
	/** When set and enabled with non-empty kinds, requires rich `visual_intent` for visual slots. */
	visualPolicy?: PracticeBlueprintVisualPolicy | null;
}): { ok: true } | { ok: false; message: string } {
	const { blueprint, allowedTopicIds, expectedTypeCounts, visualPolicy } = args;
	const counts = {
		multiple_choice: blueprint.slots_by_type.multiple_choice.length,
		fill_in_blank: blueprint.slots_by_type.fill_in_blank.length,
		short_answer: blueprint.slots_by_type.short_answer.length,
		long_answer: blueprint.slots_by_type.long_answer.length,
	};
	if (
		counts.multiple_choice !== expectedTypeCounts.multiple_choice ||
		counts.fill_in_blank !== expectedTypeCounts.fill_in_blank ||
		counts.short_answer !== expectedTypeCounts.short_answer ||
		counts.long_answer !== expectedTypeCounts.long_answer
	) {
		return { ok: false, message: "Blueprint question type counts do not match expected plan." };
	}

	const slots = flattenPracticeGenerationBlueprint(blueprint);
	if (slots.length === 0) {
		return { ok: false, message: "Blueprint contains no question slots." };
	}

	const policyOn =
		visualPolicy?.enabled === true &&
		Array.isArray(visualPolicy.preferredKinds) &&
		visualPolicy.preferredKinds.length > 0;
	const allowedKindSet = policyOn ? new Set<string>(visualPolicy!.preferredKinds) : null;

	for (const slot of slots) {
		if (!allowedTopicIds.has(slot.topic_id)) {
			const canonicalTopicId = findUniqueNearTopicIdMatch(slot.topic_id, allowedTopicIds);
			if (!canonicalTopicId) {
				return { ok: false, message: `Blueprint slot has disallowed topic_id: ${slot.topic_id}` };
			}
			slot.topic_id = canonicalTopicId;
		}

		const vi = slot.visual_intent;
		if (vi) {
			if (vi.needs_visual && vi.priority === "none") {
				return {
					ok: false,
					message: `Blueprint slot ${slot.slot_id}: visual_intent.priority cannot be "none" when needs_visual is true.`,
				};
			}
			if (!vi.needs_visual && vi.priority !== "none") {
				return {
					ok: false,
					message: `Blueprint slot ${slot.slot_id}: visual_intent.priority must be "none" when needs_visual is false.`,
				};
			}
			if (policyOn && vi.needs_visual) {
				const idea = vi.visual_idea?.trim() ?? "";
				if (idea.length < 8) {
					return {
						ok: false,
						message: `Blueprint slot ${slot.slot_id}: visual_intent.visual_idea must describe the stimulus (≥8 chars) when needs_visual is true.`,
					};
				}
				const pk = vi.preferred_kind?.trim() ?? "";
				if (!pk) {
					return {
						ok: false,
						message: `Blueprint slot ${slot.slot_id}: visual_intent.preferred_kind must be set when needs_visual is true.`,
					};
				}
				if (!allowedKindSet!.has(pk)) {
					return {
						ok: false,
						message: `Blueprint slot ${slot.slot_id}: visual_intent.preferred_kind "${pk}" is not in visual_policy.preferred_kinds.`,
					};
				}
			}
		}
	}

	return { ok: true };
}
