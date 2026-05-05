import type { GeneratePracticeResult } from "../../../app/student/practice/actions/types";

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
	message: string;
};

export type GenerateStreamEnvelope =
	| GenerateStreamPartialEnvelope
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
	return { type: "error", code: result.code, message: truncateMessage(result.message) };
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
