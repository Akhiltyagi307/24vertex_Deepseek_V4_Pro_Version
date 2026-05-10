/**
 * Server-only env helpers for the visuals feature.
 *
 * Two booleans plus one optional model override:
 *
 *   PRACTICE_VISUALS                — master switch for Pass 1 visual emission.
 *                                     When false (default), the system prompt
 *                                     forces `visual: null` on every question
 *                                     and the visuals_policy on the user
 *                                     message reports `enabled: false`.
 *   PRACTICE_VISUAL_VALIDATOR       — Pass 2 validator-pass switch. Read by
 *                                     practice-generation-pipeline.ts to gate
 *                                     the validator skills run.
 *   PRACTICE_VISUAL_VALIDATOR_MODEL — optional explicit model id for Pass 2.
 *                                     Falls back to getOpenAIPracticeChatModel().
 */

export function isPracticeVisualsEnabled(): boolean {
	return process.env.PRACTICE_VISUALS === "true";
}

export function isPracticeVisualValidatorEnabled(): boolean {
	return process.env.PRACTICE_VISUAL_VALIDATOR === "true";
}

export function getPracticeVisualValidatorModel(): string | null {
	const v = process.env.PRACTICE_VISUAL_VALIDATOR_MODEL;
	return v != null && v.trim().length > 0 ? v.trim() : null;
}
