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
 *   PRACTICE_VISUALS_MAX_FRACTION    — optional; default 0.5. Soft cap:
 *                                     ceil(n × fraction), clamped to [1, n].
 *   PRACTICE_VISUALS_MAX_ABS        — optional extra upper bound on non-null
 *                                     visuals (applied as min with computed cap).
 *   PRACTICE_VISUAL_EXEMPLAR_COUNT  — optional; few-shot count 3–12, default 6.
 */

export function isPracticeVisualsEnabled(): boolean {
	return process.env.PRACTICE_VISUALS === "true";
}

/**
 * Optional CSV allowlist: `PRACTICE_VISUALS_SUBJECTS=Mathematics,Accountancy`.
 * When unset (or whitespace-only), every subject may use visuals as long as
 * `PRACTICE_VISUALS=true`. When set, subject names are matched case-insensitively
 * against `subjects.name` / the payload `subject.name`.
 */
export function parsePracticeVisualsSubjectAllowlist(): string[] | null {
	const raw = process.env.PRACTICE_VISUALS_SUBJECTS?.trim();
	if (!raw) return null;
	const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
	return parts.length > 0 ? parts : null;
}

export function isPracticeVisualsEnabledForSubject(subjectName: string): boolean {
	if (!isPracticeVisualsEnabled()) return false;
	const allow = parsePracticeVisualsSubjectAllowlist();
	if (allow == null) return true;
	const norm = subjectName.trim().toLowerCase();
	return allow.some((s) => s.trim().toLowerCase() === norm);
}

/**
 * Max targeted VISUAL_FIX `generateObject` rounds after a failing visual
 * quality gate (default 2). Set `PRACTICE_VISUAL_FIX_MAX_CALLS=0` to skip.
 */
export function getPracticeVisualFixMaxCalls(): number {
	const raw = process.env.PRACTICE_VISUAL_FIX_MAX_CALLS;
	if (raw != null && raw.trim() !== "") {
		const n = Number.parseInt(raw, 10);
		if (Number.isFinite(n) && n >= 0) return n;
	}
	return 2;
}

export function isPracticeVisualValidatorEnabled(): boolean {
	return process.env.PRACTICE_VISUAL_VALIDATOR === "true";
}

export function getPracticeVisualValidatorModel(): string | null {
	const v = process.env.PRACTICE_VISUAL_VALIDATOR_MODEL;
	return v != null && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Max non-null `visual` envelopes per generated test (soft cap for the model).
 * `PRACTICE_VISUALS_MAX_FRACTION` (default 0.5): ceil(count × fraction), then
 * clamped to [1, count]. Optional `PRACTICE_VISUALS_MAX_ABS` applies an extra
 * upper bound (min with computed cap).
 */
export function computeMaxNonNullVisuals(estimatedQuestionCount: number): number {
	if (estimatedQuestionCount <= 0) return 0;
	const raw = Number(process.env.PRACTICE_VISUALS_MAX_FRACTION);
	const fraction = Number.isFinite(raw) ? Math.min(1, Math.max(0.05, raw)) : 0.5;
	let cap = Math.ceil(estimatedQuestionCount * fraction);
	const absRaw = process.env.PRACTICE_VISUALS_MAX_ABS;
	if (absRaw != null && absRaw.trim() !== "") {
		const absCap = Number.parseInt(absRaw, 10);
		if (Number.isFinite(absCap) && absCap >= 0) cap = Math.min(cap, absCap);
	}
	return Math.max(1, Math.min(cap, estimatedQuestionCount));
}

/** Few-shot exemplar count for the visuals block (default 6). */
export function getPracticeVisualExemplarCount(): number {
	const raw = process.env.PRACTICE_VISUAL_EXEMPLAR_COUNT;
	if (raw == null || raw.trim() === "") return 6;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 3 && n <= 12 ? n : 6;
}
