import "server-only";

import { generateText } from "ai";
import { z } from "zod";

import {
	extractDeepSeekCacheTokens,
	extractReasoningTokens,
	getDeepSeekProvider,
} from "@/lib/ai/deepseek-provider";
import { resolveChatModel } from "@/lib/ai/model-router";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { generateStructured } from "@/lib/ai/structured-output";
import { getOpenAIPracticeChatModel } from "@/lib/env";
import type { PracticeEvidenceMap } from "@/lib/practice/generation-evidence-pack";
import { selectEvidenceForFailedIndexes } from "@/lib/practice/generation-evidence-pack";
import type { PracticeGenerationOutput } from "@/lib/practice/generation-schema";
import { logServerError } from "@/lib/server/log-supabase-error";

import type { VisualPatch } from "./apply-visual-patches";
import { getPracticeVisualEnrichmentModel, isPracticeVisualEnrichmentEnabled } from "./env";
import { parseVisualPatchesFromValidatorText } from "./parse-validator-patches";
import { questionVisualEnvelopeSchema } from "./schemas";
import type { QuestionVisualKind } from "./types";
import {
	buildVisualEnrichmentSystemPrompt,
	buildVisualEnrichmentUserPrompt,
} from "./visual-enrichment-prompt";

/**
 * Zod schema for the DeepSeek visual-enrichment output. We force a structured
 * `{ patches: [...] }` shape so the structured-output adapter can:
 *   - inflate maxOutputTokens for thinking mode (3x via deepseekAdjustedMaxOutputTokens)
 *   - run JSON parse + Zod validation with one repair turn on failure
 *   - validate the visual envelope itself in-line (the previous code did this
 *     post-hoc in sanitizeVisualEnrichmentPatches, which left malformed
 *     envelopes silently dropped without a repair attempt)
 *
 * Only `replace_visual` and `null_visual` actions are accepted; the legacy
 * `rewrite_stem` / `rewrite_explanation` actions the validator-text parser
 * also recognised were never wired into apply-visual-patches anyway.
 */
const enrichmentReplaceVisualSchema = z.object({
	action: z.literal("replace_visual"),
	index: z.number().int().nonnegative(),
	value: questionVisualEnvelopeSchema,
});
const enrichmentNullVisualSchema = z.object({
	action: z.literal("null_visual"),
	index: z.number().int().nonnegative(),
});
const enrichmentPatchSchema = z.discriminatedUnion("action", [
	enrichmentReplaceVisualSchema,
	enrichmentNullVisualSchema,
]);
const visualEnrichmentOutputSchema = z.object({
	patches: z.array(enrichmentPatchSchema).max(30),
});

type VisualEnrichmentPatch = Extract<VisualPatch, { action: "replace_visual" | "null_visual" }>;

function unwrapVisualEnvelope(value: unknown): unknown {
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

function sanitizeVisualEnrichmentPatches(
	rawPatches: VisualPatch[],
	candidateIndexes: number[],
): VisualEnrichmentPatch[] {
	const candidateSet = new Set(candidateIndexes);
	const byIndex = new Map<number, VisualEnrichmentPatch>();
	for (const patch of rawPatches) {
		if (!candidateSet.has(patch.index)) continue;
		if (patch.action === "replace_visual") {
			const parsed = questionVisualEnvelopeSchema.safeParse(unwrapVisualEnvelope(patch.value));
			if (!parsed.success) continue;
			// Prefer schema-valid replace_visual over null_visual for the same index.
			byIndex.set(patch.index, {
				action: "replace_visual",
				index: patch.index,
				value: parsed.data,
			});
			continue;
		}
		if (patch.action === "null_visual") {
			const existing = byIndex.get(patch.index);
			if (existing?.action === "replace_visual") continue;
			byIndex.set(patch.index, patch);
		}
	}
	return [...byIndex.values()];
}

export type GenerateVisualEnrichmentResult = {
	ok: boolean;
	patches: VisualPatch[];
	modelMs: number;
	inputTokens: number;
	outputTokens: number;
};

export async function generateVisualEnrichmentPass(args: {
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
		/** Blueprint `visual_idea` brief for this index, when present. */
		blueprint_visual_idea?: string | null;
	}>;
	strictGrounding?: boolean;
	requireAtLeastOneVisual?: boolean;
	generationRunId?: string | null;
	correlationId?: string | null;
	abortSignal?: AbortSignal;
}): Promise<GenerateVisualEnrichmentResult> {
	if (!isPracticeVisualEnrichmentEnabled()) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}
	if (args.preferredKinds.length === 0) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}

	const nullVisualCandidateIndexes = args.output.questions
		.map((q, i) => (q.visual == null ? i : -1))
		.filter((i) => i >= 0);
	const candidateIndexesBase =
		args.candidateIndexes ?
			args.candidateIndexes.filter((i) => nullVisualCandidateIndexes.includes(i))
		:	nullVisualCandidateIndexes;
	const candidateIndexes = [...new Set(candidateIndexesBase)]
		.slice(0, Math.max(1, args.maxCandidateCount ?? args.output.questions.length));

	if (candidateIndexes.length === 0) {
		return { ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 };
	}

	// Two model paths:
	//   - OpenAI: keep the `.responses(...)` Responses API call + free-form
	//     text parser. This was the original path and is known good.
	//   - DeepSeek: route through `generateStructured` so the adapter can
	//     inflate maxOutputTokens for thinking (avoids the silent empty-text
	//     failure mode where CoT eats the whole 8K budget), validate the
	//     visual envelope inline, and retry on schema mismatch.
	const resolved = resolveChatModel("practice.generation.visual_enrichment");
	const overrideModelId = getPracticeVisualEnrichmentModel();
	const modelId =
		overrideModelId ?? (resolved.provider === "openai" ? getOpenAIPracticeChatModel() : resolved.modelId);
	const strictGrounding = args.strictGrounding !== false;
	const t0 = Date.now();
	try {
		const topicEvidence = selectEvidenceForFailedIndexes(
			args.evidenceByTopicId,
			args.output.questions,
			candidateIndexes,
		);
		const system = buildVisualEnrichmentSystemPrompt({ strictGrounding });
		const prompt = buildVisualEnrichmentUserPrompt({
			output: args.output,
			subjectName: args.subjectName,
			preferredKinds: args.preferredKinds,
			candidateIndexes,
			candidateIntent: args.candidateIntent,
			topicEvidence,
			topicExemplarHint: args.topicExemplarHint,
			templatePolicy: args.templatePolicy ?? null,
			strictGrounding,
			requireAtLeastOneVisual: args.requireAtLeastOneVisual,
		});

		let rawPatches: VisualPatch[];
		let inputTokens: number;
		let outputTokens: number;
		let reasoningTokens: number | null = null;
		let cacheHitTokens: number | null = null;
		let cacheMissTokens: number | null = null;

		if (resolved.provider === "deepseek") {
			const structured = await generateStructured({
				resolved,
				schema: visualEnrichmentOutputSchema,
				system,
				prompt,
				maxOutputTokens: 8192, // adapter inflates 3x for thinking
				maxRetries: 0,
				maxRepairAttempts: 1,
				abortSignal: args.abortSignal,
			});
			rawPatches = structured.object.patches.map((p): VisualPatch =>
				p.action === "replace_visual"
					? { action: "replace_visual", index: p.index, value: p.value }
					: { action: "null_visual", index: p.index },
			);
			inputTokens = structured.usage.inputTokens ?? 0;
			outputTokens = structured.usage.outputTokens ?? 0;
			reasoningTokens = structured.telemetry.reasoningTokens;
			cacheHitTokens = structured.telemetry.cacheHitTokens;
			cacheMissTokens = structured.telemetry.cacheMissTokens;
		} else {
			const result = await generateText({
				model: getOpenAIProvider().responses(modelId),
				system,
				prompt,
				maxOutputTokens: 8192,
				maxRetries: 0,
				abortSignal: args.abortSignal,
			});
			rawPatches = parseVisualPatchesFromValidatorText(result.text);
			inputTokens = result.usage?.inputTokens ?? 0;
			outputTokens = result.usage?.outputTokens ?? 0;
		}

		const patches = sanitizeVisualEnrichmentPatches(rawPatches, candidateIndexes);
		const hasReplaceVisual = patches.some((patch) => patch.action === "replace_visual");
		const requirementSatisfied =
			args.requireAtLeastOneVisual === true ? hasReplaceVisual : true;

		void recordAiCall({
			feature: "practice.generation.visual_enrichment",
			model: modelId,
			userId: args.userId,
			promptId: null,
			generationRunId: args.generationRunId ?? null,
			correlationId: args.correlationId ?? null,
			stepKey: "visual_enrichment",
			inputTokens,
			outputTokens,
			reasoningTokens,
			cacheHitTokens,
			cacheMissTokens,
			provider: resolved.provider,
			latencyMs: Date.now() - t0,
			status: "ok",
		});

		return {
			ok: requirementSatisfied,
			patches: requirementSatisfied ? patches : [],
			modelMs: Date.now() - t0,
			inputTokens,
			outputTokens,
		};
	} catch (error) {
		logServerError("generateVisualEnrichmentPass", error, {
			correlationId: args.correlationId ?? null,
		});
		void recordAiCall({
			feature: "practice.generation.visual_enrichment",
			model: modelId,
			userId: args.userId,
			promptId: null,
			generationRunId: args.generationRunId ?? null,
			correlationId: args.correlationId ?? null,
			stepKey: "visual_enrichment",
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs: Date.now() - t0,
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			ok: false,
			patches: [],
			modelMs: Date.now() - t0,
			inputTokens: 0,
			outputTokens: 0,
		};
	}
}
