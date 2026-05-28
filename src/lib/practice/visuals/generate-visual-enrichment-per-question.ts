import "server-only";

import { generateText } from "ai";
import { z } from "zod";

import { resolveChatModel } from "@/lib/ai/model-router";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { generateStructuredWithProviderFallback } from "@/lib/ai/structured-output";
import { getOpenAIPracticeChatModel } from "@/lib/env";
import type { PracticeEvidenceMap } from "@/lib/practice/generation-evidence-pack";
import { selectEvidenceForFailedIndexes } from "@/lib/practice/generation-evidence-pack";
import type { PracticeGenerationOutput } from "@/lib/practice/generation-schema";
import { pLimit } from "@/lib/practice/ai-retry";
import { logServerError } from "@/lib/server/log-supabase-error";
import { logPracticeObs } from "@/lib/server/practice-observability";

import type { VisualPatch } from "./apply-visual-patches";
import {
	getPracticeVisualEnrichmentConcurrency,
	getPracticeVisualEnrichmentModel,
	isPracticeVisualEnrichmentEnabled,
} from "./env";
import type { GenerateVisualEnrichmentResult } from "./generate-visual-enrichment";
import { questionVisualEnvelopeSchema } from "./schemas";
import type { QuestionVisualKind } from "./types";
import {
	buildPerQuestionVisualEnrichmentSystemPrompt,
	buildPerQuestionVisualEnrichmentUserPrompt,
} from "./visual-enrichment-prompt";

/**
 * Per-question parallel visual enrichment driver. Fires K independent
 * `generateStructured` calls — one per candidate question — and aggregates
 * the resulting envelopes into a single `GenerateVisualEnrichmentResult`.
 *
 * Why this exists: today's `generateVisualEnrichmentPass` (in
 * `generate-visual-enrichment.ts`) ships a single batched call whose output
 * is a `{ patches: [...] }` array. On 3call the pipeline has no retry round,
 * so a single Zod-parse failure on that array zeroes the whole batch (we
 * observed 0/15 visuals on Math + Stats on the same day this driver was
 * written, both due to single-batch failure).
 *
 * The per-question driver isolates failures: one bad envelope drops only
 * that question's visual; the K-1 others still ship. Plus the LLM gets
 * tighter context per call (just one stem + topic evidence for that topic +
 * kind-targeted exemplars) → denser skill signal.
 */

/**
 * Per-question structured-output schema. A single object — NOT wrapped in
 * `{ patches: [...] }` — because each call produces exactly one outcome.
 * `action === "replace_visual"` requires a valid `value` envelope;
 * `action === "null_visual"` does not.
 */
const perQuestionReplaceSchema = z.object({
	action: z.literal("replace_visual"),
	index: z.number().int().nonnegative(),
	value: questionVisualEnvelopeSchema,
});
const perQuestionNullSchema = z.object({
	action: z.literal("null_visual"),
	index: z.number().int().nonnegative(),
});
const perQuestionEnrichmentSchema = z.discriminatedUnion("action", [
	perQuestionReplaceSchema,
	perQuestionNullSchema,
]);

type PerCallSuccess = {
	ok: true;
	index: number;
	patch: VisualPatch;
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number | null;
	cacheHitTokens: number | null;
	cacheMissTokens: number | null;
	latencyMs: number;
};

type PerCallFailure = {
	ok: false;
	index: number;
	latencyMs: number;
	error: string;
};

type PerCallResult = PerCallSuccess | PerCallFailure;

function unwrapEnvelopeShape(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const record = value as Record<string, unknown>;
	if (record.visual && typeof record.visual === "object" && !Array.isArray(record.visual)) {
		return record.visual;
	}
	if (record.value && typeof record.value === "object" && !Array.isArray(record.value)) {
		return record.value;
	}
	return value;
}

export async function generateVisualEnrichmentPerQuestion(args: {
	output: PracticeGenerationOutput;
	userId: string;
	subjectName: string;
	preferredKinds: QuestionVisualKind[];
	evidenceByTopicId: PracticeEvidenceMap;
	topicExemplarHint?: string | null;
	templatePolicy?: import("../user-message").PracticeUserMessagePayload["test_parameters"]["visuals_policy"]["template_policy"] | null;
	maxCandidateCount?: number;
	candidateIndexes?: number[];
	candidateIntent?: Array<{
		index: number;
		priority: "necessary" | "high" | "medium";
		reason: string;
		preferred_kind: QuestionVisualKind | null;
		blueprint_visual_idea?: string | null;
	}>;
	strictGrounding?: boolean;
	requireAtLeastOneVisual?: boolean;
	generationRunId?: string | null;
	correlationId?: string | null;
	abortSignal?: AbortSignal;
}): Promise<GenerateVisualEnrichmentResult> {
	const wallT0 = Date.now();
	if (!isPracticeVisualEnrichmentEnabled()) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}
	if (args.preferredKinds.length === 0) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}

	// Filter to questions whose `visual` is still null AND that have a
	// candidateIntent entry (the caller is expected to pass {necessary, high,
	// medium} candidate indexes via the pipeline's selectByPriority widen).
	const nullVisualIndexes = new Set(
		args.output.questions
			.map((q, i) => (q.visual == null ? i : -1))
			.filter((i) => i >= 0),
	);
	const intentByIndex = new Map((args.candidateIntent ?? []).map((it) => [it.index, it]));
	const candidateIndexes = [
		...new Set(
			(args.candidateIndexes ?? [...nullVisualIndexes]).filter((i) => nullVisualIndexes.has(i)),
		),
	].slice(0, Math.max(1, args.maxCandidateCount ?? args.output.questions.length));

	if (candidateIndexes.length === 0) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}

	const resolved = resolveChatModel("practice.generation.visual_enrichment");
	const overrideModelId = getPracticeVisualEnrichmentModel();
	const modelId =
		overrideModelId ??
		(resolved.provider === "openai" ? getOpenAIPracticeChatModel() : resolved.modelId);
	const strictGrounding = args.strictGrounding !== false;
	// Narrow the env-cap to the actual candidate count when smaller. Avoids
	// e.g. capping at 8 when there are only 3 candidates (saves 0 latency but
	// keeps `pLimit` from spawning idle workers) AND avoids capping at 8 when
	// there are 12 candidates if the env raised cap to 12+ (saves ~10s wall
	// by collapsing 2 waves of 8+4 into one wave of 12).
	const candidateCount = Math.max(1, candidateIndexes.length);
	const concurrency = Math.min(
		getPracticeVisualEnrichmentConcurrency(),
		candidateCount,
	);

	const system = buildPerQuestionVisualEnrichmentSystemPrompt({ strictGrounding });

	const tasks: Array<() => Promise<PerCallResult>> = candidateIndexes.map((index) => async () => {
		const callT0 = Date.now();
		const intent = intentByIndex.get(index);
		if (!intent) {
			// Synthesize a minimal intent record so the prompt is still valid.
			// This keeps the driver robust if the pipeline forgot to pass intent.
			const synthesized = {
				index,
				priority: "medium" as const,
				reason: "synthesized_default",
				preferred_kind: null as QuestionVisualKind | null,
				blueprint_visual_idea: null,
			};
			return runOneCall({
				args,
				resolved,
				modelId,
				system,
				strictGrounding,
				index,
				intent: synthesized,
				callT0,
			});
		}
		return runOneCall({
			args,
			resolved,
			modelId,
			system,
			strictGrounding,
			index,
			intent,
			callT0,
		});
	});

	// pLimit throws on first rejection — so tasks are already wrapped to never
	// reject (they return a PerCallFailure object instead). That guarantees
	// pLimit completes all candidates and the driver aggregates everything.
	const results = await pLimit(concurrency, tasks);

	const patches: VisualPatch[] = [];
	let totalInputTokens = 0;
	let totalOutputTokens = 0;
	let totalLatencyMsSum = 0;
	let succeeded = 0;
	let failed = 0;

	for (const r of results) {
		totalLatencyMsSum += r.latencyMs;
		if (r.ok) {
			succeeded += 1;
			patches.push(r.patch);
			totalInputTokens += r.inputTokens;
			totalOutputTokens += r.outputTokens;
		} else {
			failed += 1;
		}
	}

	const hasReplaceVisual = patches.some((p) => p.action === "replace_visual");
	const requirementSatisfied =
		args.requireAtLeastOneVisual === true ? hasReplaceVisual : true;

	logPracticeObs({
		phase: "practice_generation_visual_enrichment_per_question",
		correlation_id: args.correlationId ?? null,
		k: candidateIndexes.length,
		succeeded,
		failed,
		patches_count: patches.length,
		concurrency,
	});

	const wallMs = Date.now() - wallT0;

	return {
		ok: requirementSatisfied,
		patches: requirementSatisfied ? patches : [],
		modelMs: wallMs,
		inputTokens: totalInputTokens,
		outputTokens: totalOutputTokens,
		perQuestionStats: {
			k: candidateIndexes.length,
			succeeded,
			failed,
			totalLatencyMsSum,
		},
	};
}

async function runOneCall(args: {
	args: Parameters<typeof generateVisualEnrichmentPerQuestion>[0];
	resolved: ReturnType<typeof resolveChatModel>;
	modelId: string;
	system: string;
	strictGrounding: boolean;
	index: number;
	intent: {
		index: number;
		priority: "necessary" | "high" | "medium";
		reason: string;
		preferred_kind: QuestionVisualKind | null;
		blueprint_visual_idea?: string | null;
	};
	callT0: number;
}): Promise<PerCallResult> {
	const {
		args: outerArgs,
		resolved,
		modelId,
		system,
		strictGrounding,
		index,
		intent,
		callT0,
	} = args;

	try {
		const topicEvidence = selectEvidenceForFailedIndexes(
			outerArgs.evidenceByTopicId,
			outerArgs.output.questions,
			[index],
		);
		const prompt = buildPerQuestionVisualEnrichmentUserPrompt({
			output: outerArgs.output,
			subjectName: outerArgs.subjectName,
			preferredKinds: outerArgs.preferredKinds,
			candidateIndex: index,
			candidateIntent: intent,
			topicEvidence,
			topicExemplarHint: outerArgs.topicExemplarHint,
			templatePolicy: outerArgs.templatePolicy ?? null,
			strictGrounding,
		});

		let inputTokens = 0;
		let outputTokens = 0;
		let reasoningTokens: number | null = null;
		let cacheHitTokens: number | null = null;
		let cacheMissTokens: number | null = null;
		let parsed:
			| { action: "replace_visual"; index: number; value: unknown }
			| { action: "null_visual"; index: number };
		let callModelId = modelId;
		let callProvider: "openai" | "deepseek" = resolved.provider;

		if (resolved.provider === "deepseek") {
			const structured = await generateStructuredWithProviderFallback({
				resolved,
				schema: perQuestionEnrichmentSchema,
				system,
				prompt,
				maxOutputTokens: 3072, // adapter inflates 3x for thinking
				maxRetries: 0,
				maxRepairAttempts: 1,
				abortSignal: outerArgs.abortSignal,
				feature: "practice.generation.visual_enrichment.per_question",
			});
			parsed = structured.object;
			inputTokens = structured.usage.inputTokens ?? 0;
			outputTokens = structured.usage.outputTokens ?? 0;
			reasoningTokens = structured.telemetry.reasoningTokens;
			cacheHitTokens = structured.telemetry.cacheHitTokens;
			cacheMissTokens = structured.telemetry.cacheMissTokens;
			callModelId = structured.telemetry.modelId;
			callProvider = structured.telemetry.provider;
		} else {
			const result = await generateText({
				model: getOpenAIProvider().responses(modelId),
				system,
				prompt,
				maxOutputTokens: 3072,
				maxRetries: 0,
				abortSignal: outerArgs.abortSignal,
			});
			inputTokens = result.usage?.inputTokens ?? 0;
			outputTokens = result.usage?.outputTokens ?? 0;
			let parsedJson: unknown;
			try {
				parsedJson = JSON.parse(result.text.trim());
			} catch {
				throw new Error("openai_response_not_json");
			}
			const parseResult = perQuestionEnrichmentSchema.safeParse(parsedJson);
			if (!parseResult.success) {
				throw new Error(`openai_schema_mismatch: ${parseResult.error.message.slice(0, 200)}`);
			}
			parsed = parseResult.data;
		}

		// Force the model's declared index back to the candidate's true index
		// (defensive — the prompt instructs the model to echo it but we should
		// not trust an LLM to obey).
		//
		// Envelope re-validation: `generateStructured` already validated the
		// envelope via `perQuestionEnrichmentSchema` (which embeds
		// `questionVisualEnvelopeSchema`), so the value is known good here.
		// `applyVisualPatches` re-runs `safeParse` as defense-in-depth before
		// committing, so a degraded envelope is still dropped gracefully.
		let patch: VisualPatch;
		if (parsed.action === "replace_visual") {
			const candidateValue = unwrapEnvelopeShape(parsed.value);
			const reParse = questionVisualEnvelopeSchema.safeParse(candidateValue);
			if (!reParse.success) {
				// Edge case: the LLM emitted something the structured-output adapter
				// accepted but the strict envelope schema (re-applied here for the
				// final patch shape) rejects. Treat as null_visual rather than
				// failing the whole per-question call.
				patch = { action: "null_visual", index };
			} else {
				patch = { action: "replace_visual", index, value: reParse.data };
			}
		} else {
			patch = { action: "null_visual", index };
		}

		const latencyMs = Date.now() - callT0;
		void recordAiCall({
			feature: "practice.generation.visual_enrichment.per_question",
			model: callModelId,
			userId: outerArgs.userId,
			promptId: null,
			generationRunId: outerArgs.generationRunId ?? null,
			correlationId: outerArgs.correlationId ?? null,
			stepKey: "visual_enrichment_per_question",
			inputTokens,
			outputTokens,
			reasoningTokens,
			cacheHitTokens,
			cacheMissTokens,
			provider: callProvider,
			latencyMs,
			status: "ok",
		});
		return {
			ok: true,
			index,
			patch,
			inputTokens,
			outputTokens,
			reasoningTokens,
			cacheHitTokens,
			cacheMissTokens,
			latencyMs,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const latencyMs = Date.now() - callT0;
		logServerError("generateVisualEnrichmentPerQuestion.one", error, {
			correlationId: outerArgs.correlationId ?? null,
			questionIndex: index,
		});
		void recordAiCall({
			feature: "practice.generation.visual_enrichment.per_question",
			model: modelId,
			userId: outerArgs.userId,
			promptId: null,
			generationRunId: outerArgs.generationRunId ?? null,
			correlationId: outerArgs.correlationId ?? null,
			stepKey: "visual_enrichment_per_question",
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs,
			status: "error",
			error: message,
		});
		return { ok: false, index, latencyMs, error: message };
	}
}
