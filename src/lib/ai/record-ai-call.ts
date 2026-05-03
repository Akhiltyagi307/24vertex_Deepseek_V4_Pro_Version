import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { aiCalls } from "@/db/schema/ai-calls";

export type RecordAiCallInput = {
	feature: string;
	model: string;
	userId?: string | null;
	promptId?: string | null;
	inputTokens: number;
	outputTokens: number;
	latencyMs: number;
	status: "ok" | "error";
	error?: string | null;
};

/**
 * Inserts a row into `ai_calls` (append-only). Never throws — failures go to Sentry.
 */
export async function recordAiCall(input: RecordAiCallInput): Promise<void> {
	try {
		await db.insert(aiCalls).values({
			feature: input.feature,
			model: input.model,
			userId: input.userId ?? null,
			promptId: input.promptId ?? null,
			inputTokens: input.inputTokens,
			outputTokens: input.outputTokens,
			latencyMs: input.latencyMs,
			status: input.status,
			error: input.error ?? null,
			costInr: null,
		});
	} catch (e) {
		Sentry.captureException(e, { tags: { feature: "ai_calls" }, extra: { aiFeature: input.feature } });
	}
}
