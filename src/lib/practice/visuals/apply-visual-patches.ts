import type { PracticeGenerationOutput } from "../generation-schema";
import { questionVisualEnvelopeSchema } from "./schemas";

export type VisualPatchAction =
	| { action: "replace_visual"; index: number; value: unknown }
	| { action: "null_visual"; index: number }
	| { action: "rewrite_stem"; index: number; question_text: string }
	| { action: "rewrite_explanation"; index: number; explanation: string };

export type VisualPatch = VisualPatchAction;

/**
 * Apply a list of patches returned by Pass 2 (the validator pass) to a
 * PracticeGenerationOutput. Pure function; returns a deep clone so the
 * caller can decide whether to keep the patched or original output.
 *
 * Bad patches (out-of-range index, unknown action, replace_visual that
 * fails Zod validation) are silently dropped — Pass 1 output should
 * always survive. The returned `applied` count lets the pipeline log
 * how many patches actually took effect.
 */
export function applyVisualPatches(
	output: PracticeGenerationOutput,
	patches: VisualPatch[],
): { output: PracticeGenerationOutput; applied: number } {
	const clone = structuredClone(output);
	let applied = 0;
	for (const patch of patches) {
		const idx = patch.index;
		if (idx < 0 || idx >= clone.questions.length) continue;
		const question = clone.questions[idx];
		if (!question) continue;
		switch (patch.action) {
			case "replace_visual": {
				const parsed = questionVisualEnvelopeSchema.safeParse(patch.value);
				if (!parsed.success) continue;
				question.visual = parsed.data;
				applied++;
				break;
			}
			case "null_visual":
				question.visual = null;
				applied++;
				break;
			case "rewrite_stem":
				if (typeof patch.question_text === "string" && patch.question_text.trim().length > 0) {
					question.question_text = patch.question_text;
					applied++;
				}
				break;
			case "rewrite_explanation":
				if (typeof patch.explanation === "string" && patch.explanation.trim().length > 0) {
					question.answer_key.explanation = patch.explanation;
					applied++;
				}
				break;
			default:
				break;
		}
	}
	return { output: clone, applied };
}
