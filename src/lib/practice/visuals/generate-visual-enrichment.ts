import "server-only";

import { generateText } from "ai";

import { recordAiCall } from "@/lib/ai/record-ai-call";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
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

	const modelId = getPracticeVisualEnrichmentModel() ?? getOpenAIPracticeChatModel();
	const strictGrounding = args.strictGrounding !== false;
	const t0 = Date.now();
	try {
		const topicEvidence = selectEvidenceForFailedIndexes(
			args.evidenceByTopicId,
			args.output.questions,
			candidateIndexes,
		);
		const result = await generateText({
			model: getOpenAIProvider().responses(modelId),
			system: buildVisualEnrichmentSystemPrompt({ strictGrounding }),
			prompt: buildVisualEnrichmentUserPrompt({
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
			}),
			maxOutputTokens: 8192,
			maxRetries: 0,
			abortSignal: args.abortSignal,
		});

		const patches = sanitizeVisualEnrichmentPatches(
			parseVisualPatchesFromValidatorText(result.text),
			candidateIndexes,
		);
		const hasReplaceVisual = patches.some((patch) => patch.action === "replace_visual");
		const requirementSatisfied =
			args.requireAtLeastOneVisual === true ? hasReplaceVisual : true;
		const inputTokens = result.usage?.inputTokens ?? 0;
		const outputTokens = result.usage?.outputTokens ?? 0;

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
