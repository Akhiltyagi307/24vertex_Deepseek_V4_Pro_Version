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
 *   PRACTICE_VISUAL_EXEMPLAR_COUNT  — optional; few-shot count 3–12, default 8.
 *   PRACTICE_VISUAL_TEMPLATE_ENGINE — when true, visual kind policy comes from
 *                                     the typed subject/topic template registry.
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

export function isPracticeVisualTemplateEngineEnabled(): boolean {
	return process.env.PRACTICE_VISUAL_TEMPLATE_ENGINE === "true";
}

/**
 * Max targeted VISUAL_FIX `generateObject` rounds after a failing visual
 * quality gate (**deprecated**: v8 unified these into repair passes under
 * `PRACTICE_GENERATION_REPAIR_BUDGET`). Kept for documentation of legacy env.
 * Historical default **2**.
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

/**
 * Stem↔visual grounding policy for deterministic validator checks.
 * - off (default): skip literal grounding checks
 * - shadow: record mismatches in telemetry but do not null visuals
 * - enforce/true: null visuals with grounding mismatches
 */
export function getPracticeVisualStemGroundingMode(): "off" | "shadow" | "enforce" {
	const raw = process.env.PRACTICE_VISUAL_STEM_GROUNDING?.trim().toLowerCase();
	if (raw === "shadow") return "shadow";
	if (raw === "enforce" || raw === "true") return "enforce";
	return "off";
}

export function getPracticeVisualValidatorModel(): string | null {
	const v = process.env.PRACTICE_VISUAL_VALIDATOR_MODEL;
	return v != null && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Dedicated visual enrichment pass between base generation and validator.
 * Defaults to the master visuals switch (`PRACTICE_VISUALS`) so projects that
 * enable visuals get enrichment automatically. Use `PRACTICE_VISUAL_ENRICHMENT`
 * to force-enable/disable explicitly.
 */
export function isPracticeVisualEnrichmentEnabled(): boolean {
	const raw = process.env.PRACTICE_VISUAL_ENRICHMENT?.trim().toLowerCase();
	if (raw === "true") return true;
	if (raw === "false") return false;
	return isPracticeVisualsEnabled();
}

/**
 * Max number of candidate indexes sent in each enrichment request.
 * Keeps prompt/token growth bounded while allowing broader visual coverage.
 *
 * Cap was 6 when enrichment ran on GPT-5.4-mini (Pro-equivalent latency).
 * Raised to 30 so the 3-call DeepSeek variant can fit a full 15-question
 * test into a single Flash+thinking call rather than fall back to the
 * deterministic placeholder template. 30 is a safety ceiling, not a target —
 * callers pass the actual candidate count they want.
 */
export function getPracticeVisualEnrichmentBatchSize(): number {
	const raw = process.env.PRACTICE_VISUAL_ENRICHMENT_BATCH_SIZE;
	if (raw == null || raw.trim() === "") return 2;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n)) return 2;
	if (n < 1) return 1;
	if (n > 30) return 30;
	return n;
}

/** Optional model override for the visual enrichment pass. */
export function getPracticeVisualEnrichmentModel(): string | null {
	const v = process.env.PRACTICE_VISUAL_ENRICHMENT_MODEL;
	return v != null && v.trim().length > 0 ? v.trim() : null;
}

/** Few-shot exemplar count for the visuals block (default 8 when env unset). */
export function getPracticeVisualExemplarCount(): number {
	const raw = process.env.PRACTICE_VISUAL_EXEMPLAR_COUNT;
	if (raw == null || raw.trim() === "") return 8;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 3 && n <= 12 ? n : 8;
}
