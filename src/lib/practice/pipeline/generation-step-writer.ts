import "server-only";

import {
	appendGenerationStep,
	type PracticeGenerationStepStatus,
} from "@/lib/practice/generation-telemetry";

export type GenerationStepInput = {
	stepKey: string;
	status: PracticeGenerationStepStatus;
	model?: string | null;
	feature?: string | null;
	latencyMs?: number | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
	error?: string | null;
	metadata?: Record<string, unknown>;
};

export type GenerationStepWriter = {
	write: (params: GenerationStepInput) => Promise<void>;
};

/**
 * Per-run generation-step log. Owns the monotonic `step_order` counter so the
 * caller doesn't have to thread mutable step state through the pipeline, and
 * forwards each step to the client (`onStage`) BEFORE the telemetry write — so
 * the client-side checklist keeps advancing even when telemetry is unavailable.
 *
 * `step_order` only advances when a `generationRunId` exists (i.e. when a step
 * is actually persisted), matching the original inline behaviour.
 */
export function createGenerationStepWriter(args: {
	generationRunId: string | null;
	onStage?: (event: { stepKey: string; status: PracticeGenerationStepStatus }) => void;
}): GenerationStepWriter {
	let stepOrder = 0;
	return {
		async write(params: GenerationStepInput): Promise<void> {
			args.onStage?.({ stepKey: params.stepKey, status: params.status });
			if (!args.generationRunId) return;
			stepOrder += 1;
			await appendGenerationStep({
				runId: args.generationRunId,
				stepOrder,
				stepKey: params.stepKey,
				status: params.status,
				model: params.model ?? null,
				feature: params.feature ?? null,
				latencyMs: params.latencyMs ?? null,
				inputTokens: params.inputTokens ?? null,
				outputTokens: params.outputTokens ?? null,
				error: params.error ?? null,
				metadata: params.metadata ?? {},
			});
		},
	};
}
