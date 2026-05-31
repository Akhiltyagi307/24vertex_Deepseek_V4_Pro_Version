import type { GeneratePracticeResult } from "../../../app/student/practice/actions/types";
import type { GenerationChecklistBucket } from "./generation-progress-buckets";

/**
 * NDJSON envelopes emitted by `/api/student/practice/generate-stream`.
 *
 * Three shapes match the three states the client cares about:
 *   - `partial`  : a streaming partial object during generation
 *   - `done`     : a successful, schema-validated result
 *   - `error`    : a generation failure or a thrown exception
 *
 * Sprint 1 fixed a regression where a failed `GeneratePracticeResult`
 * (`{ ok: false, code, message }`) was being wrapped in a `done` envelope —
 * a naive client read that as success and rendered an empty test. The
 * helpers below ensure success and failure produce structurally distinct
 * envelopes so the client cannot conflate them.
 *
 * Pulled into a dedicated module so the envelope shape can be unit-tested
 * without mocking the whole route handler / OpenAI pipeline.
 */

const MAX_ERROR_MESSAGE_CHARS = 400;

export type GenerateStreamPartialEnvelope = { type: "partial"; partial: unknown };
export type GenerateStreamDoneEnvelope = {
	type: "done";
	result: Extract<GeneratePracticeResult, { ok: true }>;
};
export type GenerateStreamErrorEnvelope = {
	type: "error";
	/** Stable code from the pipeline ("generation_failed", etc.) — null when the error came from a thrown exception. */
	code?: string;
	/** Correlates user-visible errors to server logs, when available. */
	correlationId?: string;
	message: string;
};

/**
 * Progress envelope for the in-flight generation checklist. Emitted directly
 * (NOT throttled like `partial`), one per pipeline step, already collapsed to a
 * stable student-facing bucket. Added after `partial`/`done`/`error`; the client
 * reader ignores unknown `type`s, so this is backward-compatible.
 */
export type GenerateStreamStageEnvelope = {
	type: "stage";
	bucket: GenerationChecklistBucket;
	status: "active" | "done" | "error";
	/** 1-based position of this bucket, for "step i of n". */
	index: number;
	total: number;
};

export type GenerateStreamEnvelope =
	| GenerateStreamPartialEnvelope
	| GenerateStreamStageEnvelope
	| GenerateStreamDoneEnvelope
	| GenerateStreamErrorEnvelope;

function truncateMessage(raw: string): string {
	if (raw.length <= MAX_ERROR_MESSAGE_CHARS) return raw;
	return `${raw.slice(0, MAX_ERROR_MESSAGE_CHARS)}…`;
}

/**
 * Pick the right envelope shape for a pipeline result. A successful result
 * goes out as `done`; a failure goes out as `error` with the pipeline's
 * stable `code` so the client can branch on it. Error messages are
 * truncated so a verbose model-error doesn't bloat NDJSON lines.
 */
export function envelopeForResult(result: GeneratePracticeResult): GenerateStreamDoneEnvelope | GenerateStreamErrorEnvelope {
	if (result.ok) {
		return { type: "done", result };
	}
	return {
		type: "error",
		code: result.code,
		correlationId: result.correlationId,
		message: truncateMessage(result.message),
	};
}

/**
 * Envelope for a thrown exception (caught at the stream boundary). Has no
 * pipeline `code` — this is by design: thrown exceptions are unexpected
 * and shouldn't be surfaced to the client as a stable taxonomy entry.
 */
export function envelopeForThrown(e: unknown): GenerateStreamErrorEnvelope {
	const raw = e instanceof Error ? e.message : "Generation failed.";
	return { type: "error", message: truncateMessage(raw) };
}

export function envelopeForPartial(partial: unknown): GenerateStreamPartialEnvelope {
	return { type: "partial", partial };
}

export function envelopeForStage(
	stage: Omit<GenerateStreamStageEnvelope, "type">,
): GenerateStreamStageEnvelope {
	return { type: "stage", ...stage };
}

/**
 * HTTP status to use for a {@link GeneratePracticeResult} failure surfaced
 * BEFORE the NDJSON stream opens (i.e., preflight failures from the
 * generation route). Centralized so the same mapping applies if other
 * routes ever surface the same failure shape.
 */
export function httpStatusForGenerateFailure(
	failure: Extract<GeneratePracticeResult, { ok: false }>,
): number {
	if (failure.paywall) return 402;
	if (failure.code === "rate_limited") return 429;
	if (failure.code === "unauthorized") return 401;
	if (failure.code === "validation_error" || failure.code === "generation_invalid") return 400;
	if (failure.code === "stale_selection" || failure.code === "subject_not_enrolled" || failure.code === "subject_mismatch" || failure.code === "inactive_topic" || failure.code === "not_student") {
		return 400;
	}
	if (failure.code === "database_error") return 500;
	return 400;
}
