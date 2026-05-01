import { buildDoubtPromptFromTemplate } from "@/lib/ai/doubt-prompt-templates";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

export type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";

/**
 * System prompt for doubt clarification. Body is loaded from docs (see `doubt-prompt-templates.ts`).
 */
export function buildDoubtSystemPrompt(scope: DoubtScopeSuccess, mode: DoubtTutorMode): string {
	return buildDoubtPromptFromTemplate(scope, mode);
}
