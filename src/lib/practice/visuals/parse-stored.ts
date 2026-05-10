import { questionVisualEnvelopeSchema, type QuestionVisualEnvelope } from "./schemas";

/**
 * Safely parse a `questions.metadata.visual` value out of the JSONB column.
 *
 * Behaviour:
 * - `null`, `undefined`, or absent ⇒ returns `{ ok: true, envelope: null }`.
 * - A well-formed envelope ⇒ returns `{ ok: true, envelope }`.
 * - Anything else (legacy shape, partial envelope, malformed spec) ⇒
 *   returns `{ ok: false, reason }`. Callers log + render with `null` so a
 *   bad row never crashes the practice session page.
 */
export function parseStoredQuestionVisual(
	raw: unknown,
): { ok: true; envelope: QuestionVisualEnvelope | null } | { ok: false; reason: string } {
	if (raw == null) return { ok: true, envelope: null };
	const parsed = questionVisualEnvelopeSchema.safeParse(raw);
	if (parsed.success) return { ok: true, envelope: parsed.data };
	const issue = parsed.error.issues[0];
	const reason = issue ? `${issue.path.join(".") || "<root>"}: ${issue.message}` : "invalid_visual";
	return { ok: false, reason };
}

/**
 * Variant for `questions.metadata` blobs (the JSONB column on practice
 * questions). Looks up `metadata.visual` and runs the safe parser on it.
 */
export function parseStoredQuestionVisualFromMetadata(
	metadata: unknown,
): { ok: true; envelope: QuestionVisualEnvelope | null } | { ok: false; reason: string } {
	if (metadata == null || typeof metadata !== "object") return { ok: true, envelope: null };
	const candidate = (metadata as Record<string, unknown>).visual;
	return parseStoredQuestionVisual(candidate);
}
