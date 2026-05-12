import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";

import { computeCostInr } from "./model-pricing";

export type RecordAiCallInput = {
	feature: string;
	model: string;
	userId?: string | null;
	promptId?: string | null;
	generationRunId?: string | null;
	correlationId?: string | null;
	testId?: string | null;
	stepKey?: string | null;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
	status: "ok" | "error";
	error?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(v: string | null | undefined): string | null {
	if (!v) return null;
	const t = v.trim();
	return UUID_RE.test(t) ? t : null;
}

function asStepKeyOrNull(v: string | null | undefined): string | null {
	if (!v) return null;
	const t = v.trim();
	if (!t) return null;
	return t.slice(0, 64);
}

/**
 * Inserts a row into `ai_calls` (append-only). Never throws — failures go to Sentry.
 *
 * cost_inr is computed from a model→USD pricing table and the project-wide
 * USD→INR rate (AI_COST_USD_TO_INR, default 83). Unknown models persist null
 * cost rather than a fabricated number; failed calls also persist null since
 * token counts on errors are not always meaningful.
 */
export async function recordAiCall(input: RecordAiCallInput): Promise<void> {
	const cost =
		input.status === "ok"
			? computeCostInr(input.model, input.inputTokens, input.outputTokens)
			: null;
	try {
		await db.insert(aiCalls).values({
			feature: input.feature,
			model: input.model,
			userId: input.userId ?? null,
			promptId: asUuidOrNull(input.promptId),
			generationRunId: asUuidOrNull(input.generationRunId),
			correlationId: asUuidOrNull(input.correlationId),
			testId: asUuidOrNull(input.testId),
			stepKey: asStepKeyOrNull(input.stepKey),
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
			latencyMs: input.latencyMs,
			status: input.status,
			error: input.error ?? null,
			costInr: cost === null ? null : cost.toFixed(4),
		});
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "ai_calls" }, extra: { aiFeature: input.feature } });
	}
}
