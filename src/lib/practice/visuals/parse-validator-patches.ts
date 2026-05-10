import { z } from "zod";

import type { VisualPatch } from "./apply-visual-patches";

const visualPatchSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("replace_visual"),
		index: z.number().int().nonnegative(),
		value: z.unknown(),
	}),
	z.object({
		action: z.literal("null_visual"),
		index: z.number().int().nonnegative(),
	}),
	z.object({
		action: z.literal("rewrite_stem"),
		index: z.number().int().nonnegative(),
		question_text: z.string(),
	}),
	z.object({
		action: z.literal("rewrite_explanation"),
		index: z.number().int().nonnegative(),
		explanation: z.string(),
	}),
]) as z.ZodType<VisualPatch>;

const patchArraySchema = z.array(visualPatchSchema);

/**
 * Extract a JSON array of visual patches from model output (raw JSON or ```json fence).
 */
export function parseVisualPatchesFromValidatorText(text: string): VisualPatch[] {
	const trimmed = text.trim();
	let raw = trimmed;
	const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(trimmed);
	if (fence?.[1]) {
		raw = fence[1].trim();
	}
	try {
		const data = JSON.parse(raw) as unknown;
		const parsed = patchArraySchema.safeParse(data);
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}
