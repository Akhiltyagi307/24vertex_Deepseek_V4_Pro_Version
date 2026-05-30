import { randomUUID } from "node:crypto";

import { APICallError, NoObjectGeneratedError } from "ai";

import {
	insertHeuristicModerationFlag,
	loadModerationContext,
	moderatePracticeGenerationText,
	moderatePracticeQuestionsPerItem,
} from "@/lib/ai/moderation";
import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import {
	generateStructuredWithProviderFallback,
	providerFallbackStepMetadata,
	streamStructuredWithProviderFallback,
} from "@/lib/ai/structured-output";

import {
	getPracticeBatchContractV2Enabled,
	getPracticeBatchEditorPassEnabled,
	getPracticeBlueprintLlmEnabled,
	getPracticeParallelBatchesEnabled,
	getPracticePipelineVariant,
} from "@/lib/env";
import { preflightPracticeTestQuota } from "@/lib/billing/entitlements";
import { buildDeterministicPracticeBlueprint } from "@/lib/practice/practice-generation-blueprint-deterministic";
import {
	buildBatchUserPromptTail,
	mergePracticeBatchOutputs,
	splitPracticeQuestionPlanIntoBatches,
	type PracticeGenerationBatch,
} from "@/lib/practice/practice-generation-batches";
import {
	auditPracticeGeneration,
	normalizePracticeGenerationArtifacts,
} from "@/lib/practice/practice-generation-batch-audit";
import { buildBatchUserPromptTailV2 } from "@/lib/practice/practice-generation-batch-contract";
import {
	applyPracticeBatchEditorPatches,
	runPracticeBatchEditorPass,
} from "@/lib/practice/practice-generation-batch-editor";
import { buildBatchSystemPromptV2 } from "@/lib/practice/practice-generation-batch-system-prompt";
import { computePracticeBatchBudget } from "@/lib/practice/practice-generation-batch-budget";
import { buildSisterBriefForBatch } from "@/lib/practice/practice-generation-batch-sister-brief";
import { runPracticeValidationPass } from "@/lib/practice/practice-validation";
import {
	mapResolveToGenerateFailure,
	type GeneratePracticeFailure,
	type GeneratePracticeResult,
} from "../../../app/student/practice/actions/types";
import {
	buildPracticeRoundRobinFlatIndexMap,
	buildPracticeValidationRepairDiagnostics,
	buildPracticeSystemPrompt,
	buildPracticeUserMessage,
	createPracticeGenerationOutputSchema,
	fetchTopicContextChunksByTopicIds,
	flattenPracticeGenerationOutput,
	normalizeGroupedEstimatedTimesToPlan,
	resolvePracticeConfigForStudent,
	summarizeGroupedQuestionTypeCounts,
	stringifyPracticeUserMessageForModel,
	validateAndStripGeneration,
	type PracticeGenerationGroupedOutput,
	type PracticeGenerationOutput,
	type PracticeRoundRobinFlatIndexMapEntry,
} from "@/lib/practice";
import {
	buildPracticeGenerationJobContext,
	generationJobConfigSnapshot,
	type PracticeGenerationJobContext,
} from "@/lib/practice/generation-job-context";
import { selectEvidenceForFailedIndexes } from "@/lib/practice/generation-evidence-pack";
import {
	getPracticeQuestionPlan,
	getPracticeQuestionPlanForSubject,
	practiceTypeCountsToQuestionMixJson,
	type PracticeQuestionTypeCounts,
} from "@/lib/practice/constants";
import {
	buildPracticeGenerationRepairSystemPrompt,
	buildPracticeGenerationRepairUserPrompt,
	failedIndexesFromQualityGate,
	type PracticeGenerationRepairReason,
} from "@/lib/practice/practice-generation-repair";
import {
	flattenPracticeGenerationBlueprint,
	type PracticeGenerationBlueprintSlot,
} from "@/lib/practice/practice-generation-blueprint-schema";
import { sanitizeForPostgresJsonb } from "@/lib/practice/postgres-jsonb-sanitize";
import { generatePracticeBlueprint } from "@/lib/practice/practice-generation-blueprint";
import { applyDeterministicPracticeAutofix } from "@/lib/practice/practice-generation-autofix";
import { buildTopicCorpusMap, evaluatePracticeGenerationQuality } from "@/lib/practice/practice-generation-quality-gates";
import { applyVisualPatches } from "@/lib/practice/visuals/apply-visual-patches";
import {
	getPracticeVisualEnrichmentBatchSize,
	getPracticeVisualEnrichmentMode,
	getPracticeVisualStemGroundingMode,
} from "@/lib/practice/visuals/env";
import { buildDeterministicFallbackVisual } from "@/lib/practice/visuals/fallback-visual";
import { generateVisualEnrichmentPass } from "@/lib/practice/visuals/generate-visual-enrichment";
import { generateVisualEnrichmentPerQuestion } from "@/lib/practice/visuals/generate-visual-enrichment-per-question";
import { runValidatorPass } from "@/lib/practice/visuals/run-validator-pass";
import {
	resolveQuestionVisualIntent,
	selectByPriority,
	selectVisualCandidateIndexes,
	shouldRequireAtLeastOneVisual,
	summarizeVisualIntentDecisions,
} from "@/lib/practice/visuals/visual-intent";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { tagTopicContextTruncated, withPracticeSpan } from "@/lib/practice/sentry-tags";
import { getPracticeGenerationRepairBudget } from "@/lib/practice/ai-retry";
import { consumeGenerationRateLimit } from "@/lib/practice/practice-rate-limit";
import {
	appendGenerationStep,
	attachTestIdToRunAiCalls,
	finishGenerationRun,
	startGenerationRun,
	updateGenerationRunConfigSnapshot,
	type PracticeGenerationRequestMode,
	type PracticeGenerationStepStatus,
} from "@/lib/practice/generation-telemetry";
import { finalizePracticeConfigSchema, type FinalizePracticeConfigInput } from "@/lib/practice/schemas";
import type { PracticeConfigResolveSuccess } from "@/lib/practice/resolve-config";
import { logPracticeObs, newPracticeCorrelationId } from "@/lib/server/practice-observability";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
type ServerSupabase = SupabaseClient;

type PracticePersistRpcError = {
	message?: string;
	code?: string;
	details?: string | null;
	hint?: string | null;
};

const PRACTICE_PERSIST_MAX_ATTEMPTS = 3;

function isRetryablePracticePersistError(error: PracticePersistRpcError | null): boolean {
	if (!error) return false;
	const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
	return (
		/\b5\d\d\b/.test(text) ||
		text.includes("cloudflare") ||
		text.includes("web server is returning an unknown error") ||
		text.includes("fetch failed") ||
		text.includes("network") ||
		text.includes("timeout")
	);
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RunGenerationPipelineOptions = {
	useStreamObject: boolean;
	requestMode?: PracticeGenerationRequestMode;
	recordGenerateClicked?: boolean;
	/** Fires for each partial object when `useStreamObject` is true. */
	onPartialObject?: (partial: unknown) => void;
	/** Cancel the OpenAI HTTP call (and downstream model retries) when fired. */
	abortSignal?: AbortSignal;
	/** Override persistence for trusted server-side flows such as educator-assigned tests. */
	persistGeneratedTest?: (input: {
		subjectId: string;
		difficulty: string;
		durationSeconds: number;
		questionCount: number;
		questionMix: unknown;
		questions: unknown;
	}) => Promise<{ data: string | null; error: PracticePersistRpcError | null }>;
};

/**
 * Tag attached to `ai_calls.prompt_id` and to `practice_generation_attempts`
 * analytics events so we can A/B prompt rewrites against historical baselines.
 * Bump when shipping a behavior-affecting prompt change.
 *
 * v4 — strict-schema-on, hard-gates + final-compliance recap, compact user
 *      message, moderate preamble trim (release v3.2.1).
 * v5 — student-friendly language block (Goal B), Visuals discipline block +
 *      per-subject reconciliations + visual quality gates (Goal A), the
 *      QuestionVisualEnvelope schema field, dormant autofix + quality gates
 *      wired into the pipeline. Pass-2 validator (PRACTICE_VISUAL_VALIDATOR)
 *      is wired but a no-op until the OpenAI Skills + shell-tool integration
 *      goes live.
 * v6 — chunk-aligned grounding instructions, caption/altText anti-spoiler
 *      discipline, grounding_policy in user JSON, visual_leaks_answer +
 *      optional lexical chunk_alignment_weak quality gates
 *      (PRACTICE_CHUNK_ALIGN_LEXICAL).
 * v7 — OpenAI Responses shell + skills for Pass 2 when skill ids are
 *      configured; targeted VISUAL_FIX loop after failing visual quality gates.
 * v8 — Repair-first pipeline: one initial generation, no full regenerations;
 *      unified repair passes for validation, quality, and dedup; optional
 *      `PRACTICE_GENERATION_MAX_OUTPUT_TOKENS` / `PRACTICE_REPAIR_MAX_OUTPUT_TOKENS`
 *      for latency.
 * v9 — visual intent loosened (blueprint medium + broader stem cues),
 *      batched enrichment candidates, strict stem-grounded enrichment/validator
 *      checks, and post-validator visual recovery pass.
 * v10 — blueprint-stage visual_idea + required preferred_kind when visuals
 *      enabled; cross-subject graphical stimulus bias; enrichment receives
 *      blueprint_visual_idea; blueprint_intent kind fallback prefers diagrams/plots.
 */
export const PRACTICE_PROMPT_REVISION = "v10" as const;

function formatGenerationError(e: unknown): string {
	if (APICallError.isInstance(e)) {
		const code = e.statusCode;
		if (code === 401) {
			return "OpenAI rejected the API key. Check OPENAI_API_KEY in your environment.";
		}
		if (code === 429) {
			return "The AI service is rate-limiting requests. Wait a moment and try again.";
		}
		const head = e.message.trim().split(/\r?\n/)[0] ?? e.message;
		return head.length > 320 ? `${head.slice(0, 320)}…` : head;
	}
	if (NoObjectGeneratedError.isInstance(e)) {
		return "The model returned data that did not match the test format. Try generating again.";
	}
	const msg = e instanceof Error ? e.message : "Unknown error";
	return msg.length > 320 ? `${msg.slice(0, 320)}…` : msg;
}

/**
 * Gated preflight: rate limit, optional billing, resolve config. Does **not** record `practice_generate_clicked`.
 * Shared by the server action and the generate-stream API route.
 */
export async function preflightPracticeGeneration(
	supabase: ServerSupabase,
	parsed: FinalizePracticeConfigInput,
): Promise<
	{ ok: true; resolved: PracticeConfigResolveSuccess } | { ok: false; result: GeneratePracticeResult }
> {
	const rateGate = await consumeGenerationRateLimit(supabase);
	if (!rateGate.ok) {
		return { ok: false, result: { ok: false, code: "generation_failed", message: rateGate.message } };
	}

	// Single auth.getUser() per request — `resolvePracticeConfigForStudent`
	// previously called this again, doubling the auth round-trip. Pass the
	// fetched user through so we only hit auth once.
	const {
		data: { user: billingUser },
	} = await supabase.auth.getUser();
	if (billingUser) {
		const billingGate = await preflightPracticeTestQuota(supabase, billingUser.id);
		if (!billingGate.ok) {
			const mapCode = (): GeneratePracticeFailure["code"] => {
				if (billingGate.code === "quota_tests") return "quota_tests";
				if (billingGate.code === "trial_expired") return "trial_expired";
				return "subscription_expired";
			};
			void recordPracticeEvent(
				supabase,
				"paywall_shown",
				{ surface: "practice_generate", reason: billingGate.code },
				{ studentId: billingUser.id },
			);
			return {
				ok: false,
				result: {
					ok: false,
					code: mapCode(),
					message: billingGate.message,
					paywall: true,
				},
			};
		}
	}

	const resolved = await resolvePracticeConfigForStudent(supabase, parsed, billingUser);
	if (!resolved.ok) {
		return { ok: false, result: mapResolveToGenerateFailure(resolved) };
	}
	return { ok: true, resolved };
}

/**
 * Strict JSON-schema mode for generation. ON by default since release v3.2.1 —
 * GPT-5.4-mini and newer reliably satisfy `z.array().length(N)` /
 * `z.null().optional()` under structured outputs, and turning it on doubled
 * one-shot success in dev. Set `PRACTICE_STRICT_JSON_SCHEMA_GENERATE=false`
 * to roll back if a future model regresses.
 */
function isStrictJsonSchemaForGenerationEnabled(): boolean {
	return process.env.PRACTICE_STRICT_JSON_SCHEMA_GENERATE !== "false";
}

/**
 * Strict JSON-schema mode for the repair pass. OFF by default — the repair
 * call already validates against the same Zod schema after the fact, and
 * structured outputs sometimes regenerate aggressively where we wanted a
 * minimal patch. Override with `PRACTICE_STRICT_JSON_SCHEMA_REPAIR=true`.
 */
function isStrictJsonSchemaForRepairEnabled(): boolean {
	return process.env.PRACTICE_STRICT_JSON_SCHEMA_REPAIR === "true";
}

/**
 * Default caps favor ~60s generation (one large structured call + a few repairs).
 * Override with PRACTICE_GENERATION_MAX_OUTPUT_TOKENS / PRACTICE_REPAIR_MAX_OUTPUT_TOKENS.
 */
function practiceGenerationMaxOutputTokens(estimatedQuestionCount: number): number {
	const raw = process.env.PRACTICE_GENERATION_MAX_OUTPUT_TOKENS?.trim();
	if (raw) {
		const n = Number.parseInt(raw, 10);
		if (Number.isFinite(n) && n >= 4_096 && n <= 16_384) return n;
	}
	return Math.min(10_000, Math.max(5_500, estimatedQuestionCount * 750));
}

function practiceRepairMaxOutputTokens(estimatedQuestionCount: number): number {
	const raw = process.env.PRACTICE_REPAIR_MAX_OUTPUT_TOKENS?.trim();
	if (raw) {
		const n = Number.parseInt(raw, 10);
		if (Number.isFinite(n) && n >= 3_072 && n <= 16_384) return n;
	}
	return Math.min(9_000, Math.max(4_800, estimatedQuestionCount * 650));
}

async function runModelOnce(
	systemPrompt: string,
	userPrompt: string,
	estimatedQuestionCount: number,
	outputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>,
	opts: Pick<RunGenerationPipelineOptions, "useStreamObject" | "onPartialObject" | "abortSignal">,
	studentUserId: string,
	telemetry: {
		generationRunId: string | null;
		correlationId: string;
		stepKey: string;
		testId?: string | null;
	},
): Promise<
	| {
			ok: true;
			object: PracticeGenerationGroupedOutput;
			usage: { inputTokens: number; outputTokens: number; latencyMs: number; model: string };
			stepMetadata?: Record<string, string | boolean>;
	  }
	| {
			ok: false;
			message: string;
			error: unknown;
			usage: { inputTokens: number; outputTokens: number; latencyMs: number; model: string };
	  }
> {
	const resolved = resolveChatModel("practice.generation");
	// Hard-cap output tokens at 12k regardless of question count. The previous
	// scaling could request up to 32k for high-question tests, which exceeds
	// per-request limits on some models and produces unpredictable cost. 12k
	// fits a 40-question schema comfortably.
	const maxOutputTokens = practiceGenerationMaxOutputTokens(estimatedQuestionCount);
	const chatModelId = resolved.modelId;
	const baseArgs = {
		resolved,
		schema: outputSchema,
		system: systemPrompt,
		prompt: userPrompt,
		maxOutputTokens,
		// Lowered from 2 → 1 in v3.2.1: HTTP-layer retries silently doubled
		// per-attempt cost on slow failures. Transient 429/503 are recovered by
		// generateStructuredWithProviderFallback / streamStructuredWithProviderFallback.
		maxRetries: 1,
		abortSignal: opts.abortSignal,
		feature: "practice.generation",
		providerOptions: {
			openai: {
				strictJsonSchema: isStrictJsonSchemaForGenerationEnabled(),
			},
		},
	};

	if (opts.useStreamObject) {
		const t0 = Date.now();
		try {
			const result = streamStructuredWithProviderFallback(baseArgs);
			const streamPartial = (async () => {
				if (!opts.onPartialObject) {
					return;
				}
				for await (const partial of result.partialObjectStream) {
					opts.onPartialObject(partial);
				}
			})();
			const [object] = await Promise.all([result.object, streamPartial]);
			const usage = await result.usage;
			const callTelemetry = await result.telemetry;
			void recordAiCall({
				feature: "practice.generation",
				model: callTelemetry.modelId,
				userId: studentUserId,
				promptId: PRACTICE_PROMPT_REVISION,
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				reasoningTokens: callTelemetry.reasoningTokens,
				cacheHitTokens: callTelemetry.cacheHitTokens,
				cacheMissTokens: callTelemetry.cacheMissTokens,
				provider: callTelemetry.provider,
				latencyMs: Date.now() - t0,
				status: "ok",
				generationRunId: telemetry.generationRunId,
				correlationId: telemetry.correlationId,
				testId: telemetry.testId ?? null,
				stepKey: telemetry.stepKey,
			});
			return {
				ok: true,
				object: object as PracticeGenerationGroupedOutput,
				usage: {
					inputTokens: usage?.inputTokens ?? 0,
					outputTokens: usage?.outputTokens ?? 0,
					latencyMs: Date.now() - t0,
					model: callTelemetry.modelId,
				},
				stepMetadata: providerFallbackStepMetadata(callTelemetry) ?? undefined,
			};
		} catch (e) {
			logServerError("runPracticeGeneration.streamObject", e);
			const latencyMs = Date.now() - t0;
			void recordAiCall({
				feature: "practice.generation",
				model: chatModelId,
				userId: studentUserId,
				promptId: PRACTICE_PROMPT_REVISION,
				generationRunId: telemetry.generationRunId,
				correlationId: telemetry.correlationId,
				testId: telemetry.testId ?? null,
				stepKey: telemetry.stepKey,
				inputTokens: 0,
				outputTokens: 0,
				provider: resolved.provider,
				latencyMs,
				status: "error",
				error: formatGenerationError(e),
			});
			return {
				ok: false,
				message: `Could not generate the test. ${formatGenerationError(e)}`,
				error: e,
				usage: { inputTokens: 0, outputTokens: 0, latencyMs, model: chatModelId },
			};
		}
	}

	const t0 = Date.now();
	try {
		const { object, usage, telemetry: callTelemetry } =
			await generateStructuredWithProviderFallback(baseArgs);
		void recordAiCall({
			feature: "practice.generation",
			model: callTelemetry.modelId,
			userId: studentUserId,
			promptId: PRACTICE_PROMPT_REVISION,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			reasoningTokens: callTelemetry.reasoningTokens,
			cacheHitTokens: callTelemetry.cacheHitTokens,
			cacheMissTokens: callTelemetry.cacheMissTokens,
			provider: callTelemetry.provider,
			latencyMs: Date.now() - t0,
			status: "ok",
			generationRunId: telemetry.generationRunId,
			correlationId: telemetry.correlationId,
			testId: telemetry.testId ?? null,
			stepKey: telemetry.stepKey,
		});
		return {
			ok: true,
			object: object as PracticeGenerationGroupedOutput,
			usage: {
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				latencyMs: Date.now() - t0,
				model: callTelemetry.modelId,
			},
			stepMetadata: providerFallbackStepMetadata(callTelemetry) ?? undefined,
		};
	} catch (e) {
		logServerError("generatePracticeTest.generateObject", e);
		const latencyMs = Date.now() - t0;
		void recordAiCall({
			feature: "practice.generation",
			model: chatModelId,
			userId: studentUserId,
			promptId: PRACTICE_PROMPT_REVISION,
			generationRunId: telemetry.generationRunId,
			correlationId: telemetry.correlationId,
			testId: telemetry.testId ?? null,
			stepKey: telemetry.stepKey,
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs,
			status: "error",
			error: formatGenerationError(e),
		});
		return {
			ok: false,
			message: `Could not generate the test. ${formatGenerationError(e)}`,
			error: e,
			usage: { inputTokens: 0, outputTokens: 0, latencyMs, model: chatModelId },
		};
	}
}

/**
 * Tail-latency guard around `runModelOnce`. Wraps the batch dispatch in a
 * soft timeout — if the slow batch exceeds it, abort via AbortController
 * and retry ONCE. The original 75s ceiling was tuned for the case "one
 * batch took 102.8s while siblings ran 22–43s" — but DeepSeek's actual
 * tail is thick enough that batches on 25-30k-token prompts (e.g. content-
 * heavy subjects like Financial Accounting Part 2) routinely take 60–90s,
 * and the 75s abort fires mid-response. When the abort lands during HTTP
 * body streaming, the Vercel AI SDK surfaces it as
 * `AI_APICallError: Failed to process successful response` (truncated
 * body); when it lands before body data, it surfaces as the bare
 * `tail_timeout` we set as the abort reason. Both modes were causing 100%
 * failure on FA Part 2 generation. Default bumped to 150s with env
 * override so we can re-tune without a deploy.
 *
 * The retry uses a fresh telemetry stepKey (suffixed `_retry`) so the
 * `practice_generation_steps` dashboard can count tail events vs first-pass
 * successes.
 *
 * One retry only. If the retry also tails-out, return the timeout failure
 * — better than waiting forever.
 */
const BATCH_TAIL_TIMEOUT_MS_DEFAULT = 200_000;
function batchTailTimeoutMs(): number {
	const raw = process.env.PRACTICE_BATCH_TAIL_TIMEOUT_MS?.trim();
	if (!raw) return BATCH_TAIL_TIMEOUT_MS_DEFAULT;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 10_000 && n <= 600_000
		? n
		: BATCH_TAIL_TIMEOUT_MS_DEFAULT;
}

async function runBatchWithTailGuard(args: {
	systemPrompt: string;
	userPrompt: string;
	slotCount: number;
	schema: ReturnType<typeof createPracticeGenerationOutputSchema>;
	opts: Pick<RunGenerationPipelineOptions, "useStreamObject" | "onPartialObject" | "abortSignal">;
	userId: string;
	baseStepKey: string;
	generationRunId: string | null;
	correlationId: string;
}): ReturnType<typeof runModelOnce> {
	const timeoutMs = batchTailTimeoutMs();
	for (let attempt = 0; attempt < 2; attempt++) {
		// Child abort controller so a tail-timeout cancels just this attempt
		// without aborting the whole pipeline. Linked to the parent signal so
		// a real cancellation (e.g. user navigates away) still propagates.
		const ac = new AbortController();
		const onParentAbort = () => ac.abort(args.opts.abortSignal?.reason);
		args.opts.abortSignal?.addEventListener?.("abort", onParentAbort);
		const timeoutId = setTimeout(
			() => ac.abort(new Error("tail_timeout")),
			timeoutMs,
		);
		try {
			const result = await runModelOnce(
				args.systemPrompt,
				args.userPrompt,
				args.slotCount,
				args.schema,
				{ ...args.opts, abortSignal: ac.signal },
				args.userId,
				{
					generationRunId: args.generationRunId,
					correlationId: args.correlationId,
					stepKey: attempt === 0 ? args.baseStepKey : `${args.baseStepKey}_retry`,
				},
			);
			return result;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			// Only retry on our own tail-timeout abort. Real cancellations or
			// other errors propagate immediately on first attempt; on retry
			// attempt, swallow the second tail-timeout and surface a clean error.
			const isTailTimeout = msg.includes("tail_timeout") || /aborted/i.test(msg);
			if (attempt === 0 && isTailTimeout && !args.opts.abortSignal?.aborted) {
				continue; // retry once with a fresh stepKey
			}
			if (isTailTimeout) {
				return {
					ok: false,
					message: `Batch ${args.baseStepKey} timed out after ${(timeoutMs / 1000).toFixed(0)}s on both attempts.`,
					error: e,
					usage: { inputTokens: 0, outputTokens: 0, latencyMs: timeoutMs, model: "unknown" },
				};
			}
			throw e;
		} finally {
			clearTimeout(timeoutId);
			args.opts.abortSignal?.removeEventListener?.("abort", onParentAbort);
		}
	}
	// Unreachable — the loop either returns or throws — but TS needs a satisfying value.
	return {
		ok: false,
		message: `Batch ${args.baseStepKey} exhausted retry budget without resolution.`,
		error: null,
		usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0, model: "unknown" },
	};
}

function isPracticeGenerationRepairEnabled(): boolean {
	return process.env.PRACTICE_GENERATION_REPAIR?.trim().toLowerCase() !== "false";
}

function isPracticeRepairFullContextEnabled(): boolean {
	return process.env.PRACTICE_REPAIR_INCLUDE_FULL_CONTEXT === "true";
}

async function runPracticeGenerationRepairGrouped(params: {
	failedGrouped: PracticeGenerationGroupedOutput;
	reason: PracticeGenerationRepairReason;
	baseUserPrompt?: string;
	targetedContextJson?: string;
	includeBaseUserPrompt?: boolean;
	flatIndexMap: PracticeRoundRobinFlatIndexMapEntry[];
	durationSeconds: number;
	expectedTypeCounts: PracticeQuestionTypeCounts;
	allowedTopicIds: string[];
	generationOutputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>;
	estimatedQuestionCount: number;
	studentUserId: string;
	telemetry: {
		generationRunId: string | null;
		correlationId: string;
		stepKey: string;
		testId?: string | null;
	};
	abortSignal?: AbortSignal;
}): Promise<
	| {
			ok: true;
			object: PracticeGenerationGroupedOutput;
			modelMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
	| { ok: false; message: string; modelMs: number; inputTokens: number; outputTokens: number }
> {
	const repairUser = buildPracticeGenerationRepairUserPrompt({
		reason: params.reason,
		timeLimitSeconds: params.durationSeconds,
		timeSumMin: Math.round(params.durationSeconds * 0.6),
		timeSumMax: Math.round(params.durationSeconds * 1.2),
		allowedTopicIds: params.allowedTopicIds,
		questionTypeCounts: params.expectedTypeCounts,
		failedGroupedJson: JSON.stringify(params.failedGrouped),
		baseUserPrompt: params.baseUserPrompt,
		targetedContextJson: params.targetedContextJson,
		includeBaseUserPrompt: params.includeBaseUserPrompt,
		flatIndexMap: params.flatIndexMap,
	});
	const t0 = Date.now();
	const maxRepairTokens = practiceRepairMaxOutputTokens(params.estimatedQuestionCount);
	const resolved = resolveChatModel("practice.generation.repair");
	const modelId = resolved.modelId;
	try {
		const { object, usage, telemetry: callTelemetry } = await generateStructuredWithProviderFallback({
			resolved,
			schema: params.generationOutputSchema,
			system: buildPracticeGenerationRepairSystemPrompt(),
			prompt: repairUser,
			maxOutputTokens: maxRepairTokens,
			maxRetries: 1,
			abortSignal: params.abortSignal,
			feature: "practice.generation.repair",
			providerOptions: {
				openai: { strictJsonSchema: isStrictJsonSchemaForRepairEnabled() },
			},
		});
		void recordAiCall({
			feature: "practice.generation.repair",
			model: callTelemetry.modelId,
			userId: params.studentUserId,
			promptId: PRACTICE_PROMPT_REVISION,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			reasoningTokens: callTelemetry.reasoningTokens,
			cacheHitTokens: callTelemetry.cacheHitTokens,
			cacheMissTokens: callTelemetry.cacheMissTokens,
			provider: callTelemetry.provider,
			latencyMs: Date.now() - t0,
			status: "ok",
			generationRunId: params.telemetry.generationRunId,
			correlationId: params.telemetry.correlationId,
			testId: params.telemetry.testId ?? null,
			stepKey: params.telemetry.stepKey,
		});
		return {
			ok: true,
			object: object as PracticeGenerationGroupedOutput,
			modelMs: Date.now() - t0,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
		};
	} catch (e) {
		logServerError("runPracticeGenerationRepairGrouped", e);
		void recordAiCall({
			feature: "practice.generation.repair",
			model: modelId,
			userId: params.studentUserId,
			promptId: PRACTICE_PROMPT_REVISION,
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs: Date.now() - t0,
			status: "error",
			error: formatGenerationError(e),
			generationRunId: params.telemetry.generationRunId,
			correlationId: params.telemetry.correlationId,
			testId: params.telemetry.testId ?? null,
			stepKey: params.telemetry.stepKey,
		});
		return {
			ok: false,
			message: formatGenerationError(e),
			modelMs: Date.now() - t0,
			inputTokens: 0,
			outputTokens: 0,
		};
	}
}

/**
 * One shared path for persisting a generated test after validation (topic context, model, dedup, RPC, billing, embeddings).
 * Used by the server action and the streaming API route.
 */
export async function runPracticeGenerationAfterResolve(
	supabase: ServerSupabase,
	parsed: FinalizePracticeConfigInput,
	resolved: PracticeConfigResolveSuccess,
	opts: RunGenerationPipelineOptions,
): Promise<GeneratePracticeResult> {
	const correlationId = newPracticeCorrelationId();
	const pipelineT0 = Date.now();
	return withPracticeSpan(
		"practice_generate",
		{
			correlation_id: correlationId,
			student_id: resolved.userId,
			subject_id: parsed.subjectId,
		},
		() =>
			runPracticeGenerationAfterResolveCore(
				supabase,
				parsed,
				resolved,
				opts,
				correlationId,
				pipelineT0,
			),
	);
}

async function runPracticeGenerationAfterResolveCore(
	supabase: ServerSupabase,
	parsed: FinalizePracticeConfigInput,
	resolved: PracticeConfigResolveSuccess,
	opts: RunGenerationPipelineOptions,
	correlationId: string,
	pipelineT0: number,
): Promise<GeneratePracticeResult> {
	let cumulativeModelMs = 0;
	let cumulativeValidationMs = 0;
	const timingsMs: Record<string, number> = {};
	// Pipeline-scoped counters so repair budget is enforced across all
	// generation attempts (not per-attempt). Lets us emit
	// `practice_generation_attempts` once at the end with accurate spend.
	let generationCallCount = 0;
	let repairCallCount = 0;
	let succeededOnCall: number | null = null;
	const requestMode = opts.requestMode ?? (opts.useStreamObject ? "stream" : "server_action");
	const generationRunId: string | null = await startGenerationRun({
		correlationId,
		studentId: resolved.userId,
		subjectId: parsed.subjectId,
		requestMode,
		configSnapshot: {
			subject_id: parsed.subjectId,
			difficulty: parsed.difficulty,
			duration_seconds: parsed.durationSeconds,
			focus_area: parsed.focusArea ?? null,
			selected_topic_count: resolved.canonicalTopics.length,
			prompt_revision: PRACTICE_PROMPT_REVISION,
		},
		startedAt: new Date(pipelineT0),
	});
	let stepOrder = 0;
	const nextStepOrder = () => {
		stepOrder += 1;
		return stepOrder;
	};
	const writeGenerationStep = async (params: {
		stepKey: string;
		status: PracticeGenerationStepStatus;
		model?: string | null;
		feature?: string | null;
		latencyMs?: number | null;
		inputTokens?: number | null;
		outputTokens?: number | null;
		error?: string | null;
		metadata?: Record<string, unknown>;
	}) => {
		if (!generationRunId) return;
		await appendGenerationStep({
			runId: generationRunId,
			stepOrder: nextStepOrder(),
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
	};

	if (opts.recordGenerateClicked !== false) {
		void recordPracticeEvent(
			supabase,
			"practice_generate_clicked",
			{
				subject_id: parsed.subjectId,
				difficulty: parsed.difficulty,
				duration_seconds: parsed.durationSeconds,
				question_count: getPracticeQuestionPlan(parsed.durationSeconds).total,
				topic_count: resolved.canonicalTopics.length,
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
	}

	const { subjectId, difficulty, durationSeconds } = parsed;
	// Mathematics subjects collapse to all-MCQ regardless of duration mix —
	// open-ended math grading is unreliable at scale and the curriculum exam
	// pattern is overwhelmingly MCQ-driven.
	const plan = getPracticeQuestionPlanForSubject(durationSeconds, resolved.subjectName);
	const expectedTypeCounts = plan.counts;
	const questionMixJson = practiceTypeCountsToQuestionMixJson(plan.counts);

	const topicIds = resolved.canonicalTopics.map((t) => t.topicId);
	const admin = createServiceRoleClient();
	const tc0 = Date.now();
	const preFetchedTopicContext = await fetchTopicContextChunksByTopicIds(admin, topicIds);
	timingsMs.topicContextFetch = Date.now() - tc0;
	await writeGenerationStep({
		stepKey: "topic_context_fetch",
		status: "ok",
		latencyMs: timingsMs.topicContextFetch,
		metadata: {
			topic_count: topicIds.length,
			context_quality: preFetchedTopicContext.meta.context_quality ?? "ok",
		},
	});

	const userPayload = buildPracticeUserMessage({
		studentGrade: resolved.studentGrade,
		subject: { id: subjectId, name: resolved.subjectName },
		difficulty,
		timeLimitSeconds: durationSeconds,
		recentErrors: resolved.recentErrors,
		topics: resolved.canonicalTopics,
		focusArea: parsed.focusArea,
		preFetchedTopicContext,
	});
	// Pass 1 is intentionally text-first. Visuals are appended later by the
	// dedicated visual enrichment + validator passes, which avoids strict-schema
	// incompatibilities in large visual unions during core question drafting.
	const generationOutputSchema = createPracticeGenerationOutputSchema(expectedTypeCounts, {
		visualsEnabled: false,
	});

	const gmeta = preFetchedTopicContext.meta;
	if (
		!gmeta.fetch_error &&
		gmeta.topic_count > 0 &&
		gmeta.context_chunk_count === 0 &&
		gmeta.exercise_chunk_count === 0 &&
		gmeta.question_bank_chunk_count === 0
	) {
		void recordPracticeEvent(
			supabase,
			"practice_topic_context_empty",
			{
				topic_count: gmeta.topic_count,
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
	}
	if (gmeta.context_quality === "low_context" || gmeta.context_quality === "no_context") {
		void recordPracticeEvent(
			supabase,
			"practice_topic_context_quality_degraded",
			{
				topic_count: gmeta.topic_count,
				context_quality: gmeta.context_quality,
				context_chunks: gmeta.context_chunk_count,
				exercise_chunks: gmeta.exercise_chunk_count,
				question_bank_chunks: gmeta.question_bank_chunk_count,
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
	}
	if (gmeta.truncated) {
		void recordPracticeEvent(
			supabase,
			"practice_topic_context_truncated",
			{
				context_chars: gmeta.context_char_total,
				exercise_chars: gmeta.exercise_char_total,
				topic_count: gmeta.topic_count,
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
		void tagTopicContextTruncated();
	}

	const topicExemplarHint =
		userPayload.topic_grounding.length > 0 ?
			userPayload.topic_grounding
				.map((t) =>
					[t.topic_name, t.curriculum_hint.unit_name, t.curriculum_hint.chapter_name]
						.filter((s) => s && String(s).trim().length > 0)
						.join(" "),
				)
				.join(" · ")
				.toLowerCase()
				.slice(0, 1500)
		:	null;

	const jobContext: PracticeGenerationJobContext = buildPracticeGenerationJobContext({
		correlationId,
		generationRunId,
		requestMode,
		parsed,
		resolved,
		userPayload,
		topicExemplarHint,
	});
	if (generationRunId) {
		await updateGenerationRunConfigSnapshot(
			generationRunId,
			generationJobConfigSnapshot(jobContext),
		);
	}
	await writeGenerationStep({
		stepKey: "job_context_built",
		status: "ok",
		metadata: generationJobConfigSnapshot(jobContext),
	});

	const systemPrompt = buildPracticeSystemPrompt({
		userMessageSummary: {
			schema_version: userPayload.schema_version,
			intent: userPayload.intent,
			test_parameters: userPayload.test_parameters,
			constraints: userPayload.constraints,
			topic_exemplar_hint: topicExemplarHint,
		},
		generationSubject: {
			subjectName: resolved.subjectName,
			subjectGrade: resolved.subjectGrade,
			subjectGroup: resolved.subjectGroup,
			studentGrade: resolved.studentGrade,
		},
	});

	const userPrompt = stringifyPracticeUserMessageForModel(userPayload);
	const expectedCount = userPayload.test_parameters.estimated_question_count;
	const topicIdSet = new Set(resolved.canonicalTopics.map((t) => t.topicId));
	const formatTypeCounts = (counts: Record<string, number>) =>
		["multiple_choice", "fill_in_blank", "short_answer", "long_answer"]
			.map((key) => `${key}=${counts[key] ?? 0}`)
			.join(", ");

	const corpusForQuality = () =>
		buildTopicCorpusMap(userPayload.topic_grounding);
	const chunkAlignmentForQuality = () =>
		({
			corpusByTopicId: corpusForQuality(),
			contextQuality: userPayload.grounding_meta.context_quality ?? "ok",
		}) as const;

	// Single initial generation + repair-only follow-ups (no full regeneration retries).
	const repairBudgetTotal = getPracticeGenerationRepairBudget();

	async function generateAndStrip(): Promise<
		| {
				ok: true;
				object: PracticeGenerationOutput;
				public: ReturnType<typeof validateAndStripGeneration>;
				grouped: PracticeGenerationGroupedOutput;
				blueprintSlots: PracticeGenerationBlueprintSlot[];
		  }
		| { ok: false; message: string; code: GeneratePracticeFailure["code"] }
	> {
		// 3-call variant skips the LLM blueprint pass entirely — we build the
		// same shape deterministically in <1ms. The downstream "BLUEPRINT
		// CONTRACT" prompt section still applies; the only behavioural change
		// is that per-slot `visual_intent` is null (visual decisions are made
		// from stem text in the later enrichment call). See
		// practice-generation-blueprint-deterministic.ts for the trade-offs.
		// Blueprint sourcing:
		// - 5call variant: always LLM (full pipeline).
		// - 3call variant default: deterministic (saves a Flash round-trip).
		// - 3call + PRACTICE_BLUEPRINT_LLM=true: LLM blueprint (V4 Flash by
		//   default via DEEPSEEK_BLUEPRINT_MODEL) so we keep 3call's visual
		//   optimizations while regaining per-slot `visual_intent` +
		//   `skill_target` from a real planning call.
		const pipelineVariant = getPracticePipelineVariant();
		const useLlmBlueprint =
			pipelineVariant !== "3call" || getPracticeBlueprintLlmEnabled();
		const blueprintResult = useLlmBlueprint
			? await generatePracticeBlueprint({
					jobContext,
					promptRevision: PRACTICE_PROMPT_REVISION,
					abortSignal: opts.abortSignal,
				})
			: {
					ok: true as const,
					blueprint: buildDeterministicPracticeBlueprint({
						expectedTypeCounts,
						topicIds: [...topicIdSet],
						difficulty: difficulty as "easy" | "medium" | "hard",
						subjectName: resolved.subjectName,
						visualsEnabled: jobContext.visuals.enabled,
						preferredKinds: jobContext.visuals.preferredKinds,
					}),
					model: "deterministic",
					modelMs: 0,
					inputTokens: 0,
					outputTokens: 0,
				};
		cumulativeModelMs += blueprintResult.modelMs;
		await writeGenerationStep({
			stepKey: "blueprint_generate",
			status: blueprintResult.ok ? "ok" : "error",
			model: blueprintResult.ok && "model" in blueprintResult ? blueprintResult.model : null,
			feature: "practice.generation.blueprint",
			latencyMs: blueprintResult.modelMs,
			inputTokens: blueprintResult.inputTokens,
			outputTokens: blueprintResult.outputTokens,
			error: blueprintResult.ok ? null : blueprintResult.message,
			metadata: {
				variant: pipelineVariant,
				blueprint_source: useLlmBlueprint ? "llm" : "deterministic",
			},
		});
		if (!blueprintResult.ok) {
			return {
				ok: false,
				message: `Could not generate a valid blueprint. ${blueprintResult.message}`,
				code: "generation_failed",
			};
		}

		const blueprintSlots = flattenPracticeGenerationBlueprint(blueprintResult.blueprint);
		const generationSystemPrompt = `${systemPrompt}

## BLUEPRINT CONTRACT (required)
- A blueprint has been produced for this test. Follow it strictly.
- Keep question order aligned with BLUEPRINT_SLOTS_JSON order.
- For each slot: keep topic_id and question_type as specified.
- Keep difficulty_level close to slot.difficulty_level unless safety/validation constraints force a minimal adjustment.
- If slot.visual_intent.needs_visual is true, write the stem so a later visual can naturally support it (e.g. "shown below", "use the graph/table", or a visual-first setup) without leaking answers. The stem + options must be consistent with slot.visual_intent.visual_idea and align with slot.visual_intent.preferred_kind (same modality — do not describe a graph in prose if the plan is a table unless the idea calls for both).
- If slot.visual_intent.needs_visual is false, keep the stem fully understandable without relying on an unseen figure.
- For this pass, emit \`visual: null\` on every question. You may include lightweight visual cues for slots marked \`needs_visual=true\`, but avoid making stems unsolvable without the later enrichment visual.`;
		// Canonical full-context user prompt. In single-call mode this is what
		// the model receives; in parallel-batched mode it stays defined for the
		// repair pass when `PRACTICE_REPAIR_INCLUDE_FULL_CONTEXT=true` (repair
		// benefits from seeing every blueprint slot, not just the batch's slice).
		const generationUserPrompt = `${userPrompt}

BLUEPRINT_SLOTS_JSON:
${JSON.stringify(blueprintSlots)}`;

		const parallelBatched = getPracticeParallelBatchesEnabled();
		const v2BatchContract = parallelBatched && getPracticeBatchContractV2Enabled();
		const m0 = Date.now();
		let grouped: PracticeGenerationGroupedOutput;

		if (parallelBatched) {
			const batches = splitPracticeQuestionPlanIntoBatches({
				plan: expectedTypeCounts,
				slots: blueprintSlots,
			});
			const totalQuestionsInTest = blueprintSlots.length;

			const v2Inputs = v2BatchContract
				? {
						userMessageSummary: {
							schema_version: userPayload.schema_version,
							intent: userPayload.intent,
							test_parameters: userPayload.test_parameters,
							constraints: userPayload.constraints,
							topic_exemplar_hint: topicExemplarHint,
							subjectName: resolved.subjectName,
							student_grade: resolved.studentGrade,
							subject_grade: resolved.subjectGrade,
						},
						generationSubject: {
							subjectName: resolved.subjectName,
							subjectGrade: resolved.subjectGrade,
							subjectGroup: resolved.subjectGroup,
							studentGrade: resolved.studentGrade,
						},
					}
				: null;

			const settled = await Promise.all(
				batches.map(async (batch: PracticeGenerationBatch) => {
					const batchSchema = createPracticeGenerationOutputSchema(batch.typeCounts, {
						visualsEnabled: false,
					});
					let batchSystemPrompt = generationSystemPrompt;
					let batchUserPrompt: string;
					if (v2BatchContract && v2Inputs) {
						const budget = computePracticeBatchBudget({
							batch,
							timeLimitSeconds: durationSeconds,
							testTypeCounts: expectedTypeCounts,
							difficulty: difficulty as "easy" | "medium" | "hard",
						});
						const sisterBrief = buildSisterBriefForBatch({ self: batch, allBatches: batches });
						batchSystemPrompt = buildBatchSystemPromptV2({
							batch,
							userMessageSummary: v2Inputs.userMessageSummary,
							generationSubject: v2Inputs.generationSubject,
						});
						batchUserPrompt = `${userPrompt}\n\n${buildBatchUserPromptTailV2({
							batch,
							totalBatches: batches.length,
							totalQuestionsInTest,
							budget,
							sisterBrief,
						})}`;
					} else {
						batchUserPrompt = `${userPrompt}\n\n${buildBatchUserPromptTail({
							batch,
							totalBatches: batches.length,
							totalQuestionsInTest,
						})}`;
					}
					const stepKey = `question_generation_batch_${batch.index + 1}_${batch.label}${
						v2BatchContract ? "_v2" : ""
					}`;
					// Tail-latency guard: in production we observed one batch take
					// 102.8s while siblings finished in 22–43s on identical input.
					// Wrap each batch in a 75s soft timeout + ONE retry. The retry
					// uses fresh telemetry tags so the dashboard can count tail events.
					const result = await runBatchWithTailGuard({
						systemPrompt: batchSystemPrompt,
						userPrompt: batchUserPrompt,
						slotCount: batch.slots.length,
						schema: batchSchema,
						opts,
						userId: resolved.userId,
						baseStepKey: stepKey,
						generationRunId,
						correlationId,
					});
					return { batch, result, stepKey };
				}),
			);

			generationCallCount += batches.length;
			cumulativeModelMs += Date.now() - m0;

			for (const { batch, result, stepKey } of settled) {
				await writeGenerationStep({
					stepKey,
					status: result.ok ? "ok" : "error",
					model: result.usage.model,
					feature: "practice.generation",
					latencyMs: result.usage.latencyMs,
					inputTokens: result.usage.inputTokens,
					outputTokens: result.usage.outputTokens,
					error: result.ok ? null : result.message,
					metadata: {
						batch_index: batch.index,
						batch_label: batch.label,
						batch_size: batch.slots.length,
						parallel_batched: true,
						v2_batch_contract: v2BatchContract,
						...(result.ok && result.stepMetadata ? result.stepMetadata : {}),
					},
				});
			}

			const firstFailure = settled.find(({ result }) => !result.ok);
			if (firstFailure) {
				return {
					ok: false,
					message: (firstFailure.result as { ok: false; message: string }).message,
					code: "generation_failed",
				};
			}

			const merged = mergePracticeBatchOutputs(
				settled.map(
					({ result }) =>
						(result as { ok: true; object: PracticeGenerationGroupedOutput }).object,
				),
			);
			grouped = normalizeGroupedEstimatedTimesToPlan(merged, durationSeconds);

			if (v2BatchContract && getPracticeBatchEditorPassEnabled()) {
				const flatForAudit = flattenPracticeGenerationOutput(grouped);

				// Deterministic pre-audit normalisation (no LLM). Cleans known
				// writer-side artefacts so the audit + editor don't waste a
				// pass on them.
				const norm = normalizePracticeGenerationArtifacts(flatForAudit.questions);
				if (norm.mcq_duplicate_correct_label_fixes > 0) {
					logPracticeObs({
						phase: "practice_generation_artifact_normalised",
						correlation_id: correlationId,
						mcq_duplicate_correct_label_fixes: norm.mcq_duplicate_correct_label_fixes,
					});
				}

				const audit = auditPracticeGeneration({
					questions: flatForAudit.questions,
					expectedTimeSumMin: Math.round(durationSeconds * 0.6),
					expectedTimeSumMax: Math.round(durationSeconds * 1.2),
				});
				await writeGenerationStep({
					stepKey: "batch_audit",
					status: "ok",
					metadata: {
						ok: audit.ok,
						issue_count: audit.issues.length,
						summary: audit.summary,
						artifact_normalised: norm,
					},
				});
				let flatMutated = norm.mcq_duplicate_correct_label_fixes > 0;
				if (!audit.ok && audit.issues.length > 0) {
					const editorResult = await runPracticeBatchEditorPass({
						output: flatForAudit,
						audit,
						userId: resolved.userId,
						correlationId,
						generationRunId,
						promptRevision: PRACTICE_PROMPT_REVISION,
						abortSignal: opts.abortSignal,
					});
					cumulativeModelMs += editorResult.modelMs;
					await writeGenerationStep({
						stepKey: "batch_editor",
						status: editorResult.ok ? "ok" : "error",
						model: editorResult.model,
						feature: "practice.generation.validation",
						latencyMs: editorResult.modelMs,
						inputTokens: editorResult.inputTokens,
						outputTokens: editorResult.outputTokens,
						error: editorResult.ok ? null : editorResult.message,
						metadata: {
							patch_count: editorResult.ok ? editorResult.patches.length : 0,
							issue_count: audit.issues.length,
						},
					});
					if (editorResult.ok && editorResult.patches.length > 0) {
						const { applied, rejected } = applyPracticeBatchEditorPatches({
							output: flatForAudit,
							patches: editorResult.patches,
						});
						logPracticeObs({
							phase: "practice_generation_batch_editor_applied",
							correlation_id: correlationId,
							applied,
							rejected,
						});
						if (applied > 0) flatMutated = true;
					}
				}

				// Re-pack flat output into grouped buckets if anything in this
				// post-merge cleanup pass changed the questions — covers both
				// the deterministic normaliser AND the editor's patches.
				if (flatMutated) {
					const re_grouped: PracticeGenerationGroupedOutput = {
						questions_by_type: {
							multiple_choice: [],
							fill_in_blank: [],
							short_answer: [],
							long_answer: [],
						},
						generation_metadata: grouped.generation_metadata,
					};
					for (const q of flatForAudit.questions) {
						const k = q.question_type as keyof typeof re_grouped.questions_by_type;
						const { question_number: _unused, ...rest } = q;
						void _unused;
						re_grouped.questions_by_type[k].push(rest as never);
					}
					grouped = normalizeGroupedEstimatedTimesToPlan(re_grouped, durationSeconds);
				}
			}
		} else {
			generationCallCount++;
			const r = await runModelOnce(
				generationSystemPrompt,
				generationUserPrompt,
				expectedCount,
				generationOutputSchema,
				opts,
				resolved.userId,
				{
					generationRunId,
					correlationId,
					stepKey: "question_generation",
				},
			);
			cumulativeModelMs += Date.now() - m0;
			await writeGenerationStep({
				stepKey: "question_generation",
				status: r.ok ? "ok" : "error",
				model: r.usage.model,
				feature: "practice.generation",
				latencyMs: r.usage.latencyMs,
				inputTokens: r.usage.inputTokens,
				outputTokens: r.usage.outputTokens,
				error: r.ok ? null : r.message,
				metadata: r.ok && r.stepMetadata ? r.stepMetadata : {},
			});
			if (!r.ok) return { ok: false, message: r.message, code: "generation_failed" };

			grouped = normalizeGroupedEstimatedTimesToPlan(r.object, durationSeconds);
		}

		const chunkAlignmentCtx = chunkAlignmentForQuality();
		const targetedIndexesForReason = (reason: PracticeGenerationRepairReason): number[] => {
			if (reason.kind === "validation") {
				return reason.diagnostics.targets
					.map((t) => t.flattenedIndex)
					.filter((n): n is number => n != null && Number.isFinite(n) && n >= 0);
			}
			return reason.failedIndexes.filter((n) => Number.isFinite(n) && n >= 0);
		};

		const buildTargetedContextJson = (
			reason: PracticeGenerationRepairReason,
			flattenedQuestions: PracticeGenerationOutput["questions"],
		): string | undefined => {
			const failedIndexes = targetedIndexesForReason(reason);
			if (failedIndexes.length === 0) return undefined;
			const topicEvidence = selectEvidenceForFailedIndexes(
				jobContext.evidenceByTopicId,
				flattenedQuestions,
				failedIndexes,
			);
			return JSON.stringify({
				failed_indexes: failedIndexes,
				failed_questions: failedIndexes.map((idx) => flattenedQuestions[idx] ?? null),
				blueprint_slots: failedIndexes.map((idx) => ({
					index: idx,
					slot: blueprintSlots[idx] ?? null,
				})),
				topic_evidence: topicEvidence,
			});
		};

		async function consumeRepair(
			reason: PracticeGenerationRepairReason,
			flatIndexMap: PracticeRoundRobinFlatIndexMapEntry[],
			flattenedQuestions: PracticeGenerationOutput["questions"],
		): Promise<boolean> {
			if (!isPracticeGenerationRepairEnabled() || repairCallCount >= repairBudgetTotal) {
				return false;
			}
			repairCallCount++;
			const includeFullContext = reason.kind === "quality" && isPracticeRepairFullContextEnabled();
			const stepKey = `repair_attempt_${repairCallCount}`;

			const repaired = await runPracticeGenerationRepairGrouped({
				failedGrouped: grouped,
				reason,
				baseUserPrompt: includeFullContext ? generationUserPrompt : undefined,
				targetedContextJson: buildTargetedContextJson(reason, flattenedQuestions),
				includeBaseUserPrompt: includeFullContext,
				flatIndexMap,
				durationSeconds,
				expectedTypeCounts,
				allowedTopicIds: [...topicIdSet],
				generationOutputSchema,
				estimatedQuestionCount: expectedCount,
				studentUserId: resolved.userId,
				telemetry: {
					generationRunId,
					correlationId,
					stepKey,
				},
				abortSignal: opts.abortSignal,
			});
			cumulativeModelMs += repaired.modelMs;
			await writeGenerationStep({
				stepKey,
				status: repaired.ok ? "ok" : "error",
				model: resolveChatModel("practice.generation.repair").modelId,
				feature: "practice.generation.repair",
				latencyMs: repaired.modelMs,
				inputTokens: repaired.inputTokens,
				outputTokens: repaired.outputTokens,
				error: repaired.ok ? null : repaired.message,
				metadata: {
					reason_kind: reason.kind,
					// Capturing the diagnostic code + truncated message + details so
					// the practice_generation_steps table is enough to attribute a
					// repair to a specific gate (validation vs quality kind, plus
					// e.g. "visual_leaks_answer"). Previously only `reason_kind`
					// was stored, which meant every quality-driven repair looked
					// identical in telemetry — making subject-specific repair
					// patterns invisible.
					reason_code: "code" in reason ? reason.code : undefined,
					reason_message:
						"message" in reason && typeof reason.message === "string"
							? reason.message.slice(0, 600)
							: undefined,
					gate_details:
						reason.kind === "quality" && reason.gateDetails ? reason.gateDetails : undefined,
					failed_indexes:
						reason.kind === "quality" && Array.isArray(reason.failedIndexes)
							? reason.failedIndexes
							: undefined,
				},
			});
			if (!repaired.ok) return false;
			grouped = normalizeGroupedEstimatedTimesToPlan(repaired.object, durationSeconds);
			return true;
		}

		for (;;) {
			const v0 = Date.now();
			const flattened = applyDeterministicPracticeAutofix(flattenPracticeGenerationOutput(grouped));
			const out = validateAndStripGeneration(flattened, expectedCount, topicIdSet, {
				expectedDurationSeconds: durationSeconds,
				expectedTypeCounts,
			});

			if (!out.ok) {
				const groupedLens = summarizeGroupedQuestionTypeCounts(grouped);
				const flatIndexMap = buildPracticeRoundRobinFlatIndexMap(groupedLens);
				const diagnostics = buildPracticeValidationRepairDiagnostics(
					flattened,
					groupedLens,
					flatIndexMap,
					{
						expectedQuestionCount: expectedCount,
						allowedTopicIds: topicIdSet,
						expectedDurationSeconds: durationSeconds,
						expectedTypeCounts,
					},
					out.message,
				);
				const repaired = await consumeRepair(
					{
						kind: "validation",
						message: out.message,
						diagnostics,
					},
					flatIndexMap,
					flattened.questions,
				);
				cumulativeValidationMs += Date.now() - v0;
				if (!repaired) {
					const actualTypeCounts = summarizeGroupedQuestionTypeCounts(grouped);
					logServerError("generatePracticeTest.validation", out.message, {
						subjectId,
						durationSeconds,
						expectedCount,
						expectedTypeCounts: formatTypeCounts(expectedTypeCounts),
						actualTypeCounts: formatTypeCounts(actualTypeCounts),
						correlationId,
					});
					return { ok: false, message: out.message, code: "generation_invalid" };
				}
				continue;
			}

			const qualityGate = evaluatePracticeGenerationQuality({
				questions: flattened.questions,
				allowedTopicCount: topicIdSet.size,
				skipMissingVisualGate: jobContext.visuals.enabled,
				chunkAlignment: chunkAlignmentCtx,
			});

			if (!qualityGate.ok) {
				const groupedLens = summarizeGroupedQuestionTypeCounts(grouped);
				const flatIndexMap = buildPracticeRoundRobinFlatIndexMap(groupedLens);
				const failedIndexes = failedIndexesFromQualityGate(qualityGate);
				const repaired = await consumeRepair(
					{
						kind: "quality",
						code: qualityGate.code,
						message: qualityGate.message,
						failedIndexes,
						gateDetails: qualityGate.details,
						preferredVisualKinds: userPayload.test_parameters.visuals_policy.preferred_kinds,
					},
					flatIndexMap,
					flattened.questions,
				);
				cumulativeValidationMs += Date.now() - v0;
				if (!repaired) {
					logServerError("generatePracticeTest.qualityGate", qualityGate.message, {
						subjectId,
						gateCode: qualityGate.code,
						correlationId,
					});
					return { ok: false, message: qualityGate.message, code: "generation_invalid" };
				}
				continue;
			}

			cumulativeValidationMs += Date.now() - v0;

			// One shared flag + blacklist load for both passes below (they must stay
			// sequential — the blob pass runs on the per-item survivors).
			const moderationCtx = await loadModerationContext();
			const perItem = await moderatePracticeQuestionsPerItem(
				flattened.questions.map((q) => q.question_text),
				moderationCtx,
			);
			if (!perItem.ok) {
				const retainedCount = flattened.questions.length - perItem.flagged.length;
				const flaggedTooMany = retainedCount < expectedCount;
				for (const flag of perItem.flagged) {
					try {
						await insertHeuristicModerationFlag({
							entityType: "practice_generation_question",
							entityId: randomUUID(),
							source: flag.source,
							reason: flag.reason,
							severity: flag.source === "profanity" ? "high" : "medium",
						});
					} catch (e) {
						logServerError("generatePracticeTest.moderation_flag.per_item", e, { correlationId });
					}
				}
				if (flaggedTooMany) {
					return {
						ok: false,
						message: "Output blocked by moderation filters.",
						code: "generation_invalid",
					};
				}
				const dropSet = new Set(perItem.flagged.map((f) => f.index));
				flattened.questions = flattened.questions.filter((_, i) => !dropSet.has(i));
			}

			const modBlob = JSON.stringify(flattened.questions);
			const mod = await moderatePracticeGenerationText(modBlob, moderationCtx);
			if (!mod.ok) {
				try {
					await insertHeuristicModerationFlag({
						entityType: "practice_generation",
						entityId: randomUUID(),
						source: mod.source,
						reason: mod.reason,
						severity: mod.source === "profanity" ? "high" : "medium",
					});
				} catch (e) {
					logServerError("generatePracticeTest.moderation_flag", e, { correlationId });
				}
				return { ok: false, message: "Output blocked by moderation filters.", code: "generation_invalid" };
			}

			return {
				ok: true,
				object: flattened,
				public: out,
				grouped,
				blueprintSlots,
			};
		}
	}

	const attempt = await generateAndStrip();
	if (!attempt.ok) {
		const failCode = attempt.code === "generation_failed" ? "generation_failed" : "generation_invalid";
		void recordPracticeEvent(
			supabase,
			"practice_generation_attempts",
			{
				generation_calls: generationCallCount,
				repair_calls: repairCallCount,
				visual_fix_calls: 0,
				succeeded_on_call: null,
				prompt_revision: PRACTICE_PROMPT_REVISION,
				outcome: failCode === "generation_failed" ? "generation_failed" : "generation_invalid",
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
		void recordPracticeEvent(
			supabase,
			"practice_generation_failed",
			{
				code: attempt.code,
				message: attempt.message,
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
		await writeGenerationStep({
			stepKey: "pipeline_failed",
			status: "error",
			error: attempt.message,
			metadata: { fail_code: failCode },
		});
		logPracticeObs({
			phase: "practice_generation",
			correlation_id: correlationId,
			ok: false,
			code: failCode,
			durationMs: Date.now() - pipelineT0,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
			},
		});
		if (generationRunId) {
			await finishGenerationRun({
				runId: generationRunId,
				status: "failed",
				failureCode: attempt.code,
				failureMessage: attempt.message,
				timingsMs: {
					...timingsMs,
					modelMs: cumulativeModelMs,
					validationMs: cumulativeValidationMs,
					totalDurationMs: Date.now() - pipelineT0,
				},
			});
		}
		return { ok: false, code: attempt.code, message: attempt.message };
	}

	const stripped = attempt.public;
	const blueprintSlots = attempt.blueprintSlots;
	succeededOnCall = generationCallCount + repairCallCount;

	void recordPracticeEvent(
		supabase,
		"practice_generation_attempts",
		{
			generation_calls: generationCallCount,
			repair_calls: repairCallCount,
			visual_fix_calls: 0,
			succeeded_on_call: succeededOnCall,
			prompt_revision: PRACTICE_PROMPT_REVISION,
			outcome: "ok",
			correlation_id: correlationId,
			generation_run_id: generationRunId,
		},
		{ studentId: resolved.userId },
	);

	const fullOutput = attempt.object;
	const totalQ = fullOutput.questions.length;

	// Embedding-based dedup against the student's question history was removed
	// when migrating to DeepSeek V4 Pro (DeepSeek has no embeddings API). See
	// docs/deepseek-migration-plan.md §4.4. The `PRACTICE_DEDUP_MAX_REGENS` env
	// knob is no longer consulted; the `questions.embedding` column remains
	// (defer destructive drop to a separate cleanup migration).

	const visualIntentDecisions = resolveQuestionVisualIntent({
		questions: fullOutput.questions,
		blueprintSlots,
		allowedKinds: jobContext.visuals.preferredKinds,
	});
	const visualIntentSummary = summarizeVisualIntentDecisions(visualIntentDecisions);

	// Visual-floor observability — does the blueprint's `needs_visual` count
	// meet the floor for visual-heavy topic sets? We log only (no enforcement
	// yet) so we can quantify how often the prompt-level floor instruction is
	// honoured before deciding whether to add deterministic promotion.
	const visualHeavyTopicHits = countVisualHeavyTopicMatches(fullOutput.questions);
	const visualFloor = visualHeavyTopicHits > 0 ?
		Math.max(4, Math.floor(0.25 * fullOutput.questions.length)) : 0;
	const visualFloorMet = visualFloor === 0 || visualIntentSummary.needs_visual_true >= visualFloor;
	if (!visualFloorMet) {
		logPracticeObs({
			phase: "practice_generation_visual_floor_unmet",
			correlation_id: correlationId,
			floor: visualFloor,
			actual_needs_visual_true: visualIntentSummary.needs_visual_true,
			visual_heavy_topic_hits: visualHeavyTopicHits,
			total_questions: fullOutput.questions.length,
		});
	}

	await writeGenerationStep({
		stepKey: "visual_intent_gate",
		status: "ok",
		metadata: {
			...visualIntentSummary,
			visual_floor: visualFloor,
			visual_floor_met: visualFloorMet,
			visual_heavy_topic_hits: visualHeavyTopicHits,
		},
	});
	logPracticeObs({
		phase: "practice_generation_visual_intent_gate",
		correlation_id: correlationId,
		...visualIntentSummary,
		visual_floor: visualFloor,
		visual_floor_met: visualFloorMet,
	});

	const countNonNullVisuals = () => fullOutput.questions.reduce((acc, q) => acc + (q.visual ? 1 : 0), 0);
	const buildCandidateIntent = (candidateIndexes: number[]) =>
		candidateIndexes.flatMap((index) => {
			const decision = visualIntentDecisions[index];
			if (!decision || decision.priority === "none") return [];
			const idea = blueprintSlots[index]?.visual_intent?.visual_idea?.trim() ?? "";
			return [
				{
					index,
					priority: decision.priority as "necessary" | "high" | "medium",
					reason: decision.reason,
					preferred_kind: decision.preferredKind,
					blueprint_visual_idea: idea.length > 0 ? idea : null,
				},
			];
		});
	const stemGroundingMode = getPracticeVisualStemGroundingMode();
	const strictGroundingForVisuals = stemGroundingMode !== "off";
	const enrichmentBatchSize = getPracticeVisualEnrichmentBatchSize();

	// Per-question mode is opt-in via PRACTICE_VISUAL_ENRICHMENT_MODE and only
	// applies to the 3call variant. 5call already has retry rounds that
	// mitigate single-batch failure, so it stays on the batch path.
	const enrichmentMode = getPracticeVisualEnrichmentMode();
	const usePerQuestionEnrichment =
		enrichmentMode === "per_question" && getPracticePipelineVariant() === "3call";

	// Per-question mode widens the initial candidate set to {necessary, high,
	// medium} — with parallel isolated calls, there's no penalty for going
	// broader, and we want every `needs_visual_true` question to get a shot.
	// Batch mode keeps today's hierarchical priority cascade.
	const initialCandidateIndexes = usePerQuestionEnrichment
		? selectByPriority(
				visualIntentDecisions.filter(
					(d) => d.needsVisual && fullOutput.questions[d.index]?.visual == null,
				),
				new Set(["necessary", "high", "medium"]),
			)
		: selectVisualCandidateIndexes({
				round: "initial",
				questions: fullOutput.questions,
				decisions: visualIntentDecisions,
			});
	const initialCandidateBatch = initialCandidateIndexes.slice(0, enrichmentBatchSize);
	const initialRequireAtLeastOneVisual = shouldRequireAtLeastOneVisual(
		initialCandidateBatch,
		visualIntentDecisions,
	);
	const initialCandidateIntent = buildCandidateIntent(initialCandidateBatch);
	const enrichmentDriver = usePerQuestionEnrichment
		? generateVisualEnrichmentPerQuestion
		: generateVisualEnrichmentPass;
	const visualEnrichmentResult = await enrichmentDriver({
		output: fullOutput,
		userId: resolved.userId,
		subjectName: resolved.subjectName,
		preferredKinds: jobContext.visuals.preferredKinds,
		evidenceByTopicId: jobContext.evidenceByTopicId,
		topicExemplarHint: jobContext.topicExemplarHint,
		templatePolicy: jobContext.visuals.templatePolicy,
		candidateIndexes: initialCandidateBatch,
		candidateIntent: initialCandidateIntent,
		maxCandidateCount: initialCandidateBatch.length,
		strictGrounding: strictGroundingForVisuals,
		requireAtLeastOneVisual: initialRequireAtLeastOneVisual,
		generationRunId,
		correlationId,
		abortSignal: opts.abortSignal,
	});
	if (
		visualEnrichmentResult.modelMs > 0 ||
		visualEnrichmentResult.patches.length > 0 ||
		initialCandidateBatch.length > 0
	) {
		const perQ = visualEnrichmentResult.perQuestionStats;
		await writeGenerationStep({
			stepKey: usePerQuestionEnrichment ? "visual_enrichment_per_question" : "visual_enrichment",
			status: visualEnrichmentResult.ok ? "ok" : "error",
			model: resolveChatModel("practice.generation.visual_enrichment").modelId,
			feature: "practice.generation.visual_enrichment",
			latencyMs: visualEnrichmentResult.modelMs,
			inputTokens: visualEnrichmentResult.inputTokens,
			outputTokens: visualEnrichmentResult.outputTokens,
			error: visualEnrichmentResult.ok ? null : "Visual enrichment failed.",
			metadata: {
				mode: usePerQuestionEnrichment ? "per_question" : "batch",
				candidate_indexes: initialCandidateBatch.length,
				patch_candidates: visualEnrichmentResult.patches.length,
				required_candidate_round: initialRequireAtLeastOneVisual,
				...(perQ
					? {
							k: perQ.k,
							succeeded: perQ.succeeded,
							failed: perQ.failed,
							total_latency_ms_sum: perQ.totalLatencyMsSum,
						}
					: {}),
			},
		});
	}
	if (visualEnrichmentResult.ok && visualEnrichmentResult.patches.length > 0) {
		const enriched = applyVisualPatches(fullOutput, visualEnrichmentResult.patches);
		fullOutput.questions = enriched.output.questions;
		logPracticeObs({
			phase: "practice_generation_visual_enrichment_applied",
			correlation_id: correlationId,
			applied: enriched.applied,
			candidates: visualEnrichmentResult.patches.length,
			non_null_visuals: countNonNullVisuals(),
		});
	}

	// Visual enrichment retry strategy varies by provider:
	// - OpenAI (sequential): each round picks up where the last left off,
	//   skipping already-filled slots. Saves cost when the first pass succeeds.
	// - DeepSeek + thinking-disabled (parallel): each call is fast and cheap
	//   on Flash; running the 2 retry rounds in parallel cuts wall clock by
	//   roughly 2x at the cost of doing a tiny bit of redundant work in the
	//   common case where round 1 already hit the target.
	const visualTarget = Math.min(
		jobContext.visuals.maxNonNullVisuals,
		fullOutput.questions.length,
		visualIntentSummary.needs_visual_true,
	);
	const enrichmentResolved = resolveChatModel("practice.generation.visual_enrichment");
	const parallelEnrichmentRetries =
		enrichmentResolved.provider === "deepseek" && enrichmentResolved.thinkingActive === false;

	if (jobContext.visuals.enabled && jobContext.visuals.preferredKinds.length > 0 && visualTarget > 0) {
		// 3-call variant: skip retry rounds entirely. The single Flash-parallel
		// enrichment call above handles all candidate slots up front, so a
		// second pass would mostly burn budget on cases that aren't actually
		// recoverable. 5-call variant keeps the two-round safety net.
		const outerPipelineVariant = getPracticePipelineVariant();
		const maxRetryRounds = outerPipelineVariant === "3call" ? 0 : 2;

		type RetryPlan = {
			round: 1 | 2;
			batch: number[];
			requireAtLeastOneVisual: boolean;
			intent: ReturnType<typeof buildCandidateIntent>;
		};

		function planRetryRound(round: 1 | 2): RetryPlan | null {
			const indexes = selectVisualCandidateIndexes({
				round: round === 1 ? "retry_1" : "retry_2",
				questions: fullOutput.questions,
				decisions: visualIntentDecisions,
			});
			const batch = indexes.slice(0, enrichmentBatchSize);
			if (batch.length === 0) return null;
			return {
				round,
				batch,
				requireAtLeastOneVisual: shouldRequireAtLeastOneVisual(batch, visualIntentDecisions),
				intent: buildCandidateIntent(batch),
			};
		}

		const runRetry = (plan: RetryPlan, beforeCount: number) =>
			generateVisualEnrichmentPass({
				output: fullOutput,
				userId: resolved.userId,
				subjectName: resolved.subjectName,
				preferredKinds: jobContext.visuals.preferredKinds,
				evidenceByTopicId: jobContext.evidenceByTopicId,
				topicExemplarHint: jobContext.topicExemplarHint,
				templatePolicy: jobContext.visuals.templatePolicy,
				candidateIndexes: plan.batch,
				candidateIntent: plan.intent,
				maxCandidateCount: plan.batch.length,
				strictGrounding: strictGroundingForVisuals,
				requireAtLeastOneVisual: plan.requireAtLeastOneVisual,
				generationRunId,
				correlationId,
				abortSignal: opts.abortSignal,
			}).then((retryVisualEnrichment) => ({ plan, retryVisualEnrichment, beforeCount }));

		async function recordRetryOutcome(args: {
			plan: RetryPlan;
			retryVisualEnrichment: Awaited<ReturnType<typeof generateVisualEnrichmentPass>>;
			beforeCount: number;
		}) {
			const { plan, retryVisualEnrichment, beforeCount } = args;
			if (
				retryVisualEnrichment.modelMs > 0 ||
				retryVisualEnrichment.patches.length > 0 ||
				plan.batch.length > 0
			) {
				await writeGenerationStep({
					stepKey: "visual_enrichment_retry",
					status: retryVisualEnrichment.ok ? "ok" : "error",
					model: resolveChatModel("practice.generation.visual_enrichment").modelId,
					feature: "practice.generation.visual_enrichment",
					latencyMs: retryVisualEnrichment.modelMs,
					inputTokens: retryVisualEnrichment.inputTokens,
					outputTokens: retryVisualEnrichment.outputTokens,
					error: retryVisualEnrichment.ok ? null : "Visual enrichment retry failed.",
					metadata: {
						candidate_indexes: plan.batch.length,
						patch_candidates: retryVisualEnrichment.patches.length,
						required_candidate_round: plan.requireAtLeastOneVisual,
						round: plan.round,
						target_non_null_visuals: visualTarget,
						before_non_null_visuals: beforeCount,
						parallel: parallelEnrichmentRetries,
					},
				});
			}
			if (retryVisualEnrichment.ok && retryVisualEnrichment.patches.length > 0) {
				const enrichedRetry = applyVisualPatches(fullOutput, retryVisualEnrichment.patches);
				fullOutput.questions = enrichedRetry.output.questions;
				logPracticeObs({
					phase: "practice_generation_visual_enrichment_retry_applied",
					correlation_id: correlationId,
					applied: enrichedRetry.applied,
					candidates: retryVisualEnrichment.patches.length,
					non_null_visuals: countNonNullVisuals(),
					retry_round: plan.round,
					visual_target: visualTarget,
				});
			} else {
				logPracticeObs({
					phase: "practice_generation_visual_enrichment_retry_applied",
					correlation_id: correlationId,
					applied: 0,
					candidates: retryVisualEnrichment.patches.length,
					non_null_visuals: countNonNullVisuals(),
					retry_round: plan.round,
					visual_target: visualTarget,
				});
			}
		}

		if (parallelEnrichmentRetries) {
			// Pre-plan both rounds based on the post-initial state, fire them
			// concurrently, then merge results in priority order. The
			// deterministic fallback below covers any slots both calls miss.
			const beforeRetryVisualCount = countNonNullVisuals();
			if (beforeRetryVisualCount < visualTarget) {
				const plans = [planRetryRound(1), planRetryRound(2)].filter(
					(p): p is RetryPlan => p !== null,
				);
				if (plans.length > 0) {
					const settled = await Promise.all(
						plans.map((p) => runRetry(p, beforeRetryVisualCount)),
					);
					// Apply round-1 patches first so round-2 doesn't overwrite higher-priority slots.
					settled.sort((a, b) => a.plan.round - b.plan.round);
					for (const r of settled) await recordRetryOutcome(r);
				}
			}
		} else {
			// OpenAI path — sequential, with early exit when target is hit.
			for (let retryRound = 1; retryRound <= maxRetryRounds; retryRound++) {
				const beforeRetryVisualCount = countNonNullVisuals();
				if (beforeRetryVisualCount >= visualTarget) break;
				const plan = planRetryRound(retryRound as 1 | 2);
				if (!plan) break;
				const r = await runRetry(plan, beforeRetryVisualCount);
				await recordRetryOutcome(r);
			}
		}
		const unresolvedNeededIndexes = selectVisualCandidateIndexes({
			round: "retry_2",
			questions: fullOutput.questions,
			decisions: visualIntentDecisions,
		});
		// 3-call variant: the deterministic fallback produces authoritative-
		// looking-but-content-wrong placeholders (it picks an off-the-shelf
		// template — "block on inclined plane", "vector addition" — that
		// rarely matches the actual stem). Better to ship visual=null on
		// those slots than wrong content masquerading as a real visual.
		// Verified by inspection: 4/9 Physics visuals in batch=15 test had
		// alt text describing an inclined plane for stems about flat tables.
		const skipDeterministicFallback = outerPipelineVariant === "3call";
		let fallbackApplied = 0;
		if (!skipDeterministicFallback) {
			for (const index of unresolvedNeededIndexes) {
				if (countNonNullVisuals() >= visualTarget) break;
				const question = fullOutput.questions[index];
				const decision = visualIntentDecisions[index];
				if (!question || !decision || question.visual) continue;
				const fallbackVisual = buildDeterministicFallbackVisual({
					questionText: question.question_text,
					preferredKind: decision.preferredKind,
					allowedKinds: jobContext.visuals.preferredKinds,
					strictGrounding: strictGroundingForVisuals,
					visualIdea: blueprintSlots[index]?.visual_intent?.visual_idea ?? null,
				});
				if (!fallbackVisual) continue;
				question.visual = fallbackVisual;
				fallbackApplied += 1;
			}
		}
		if (fallbackApplied > 0) {
			await writeGenerationStep({
				stepKey: "visual_enrichment_fallback",
				status: "ok",
				feature: "practice.generation.visual_enrichment",
				metadata: {
					applied: fallbackApplied,
					target_non_null_visuals: visualTarget,
					remaining_needed_after_fallback: Math.max(0, visualTarget - countNonNullVisuals()),
				},
			});
			logPracticeObs({
				phase: "practice_generation_visual_enrichment_fallback_applied",
				correlation_id: correlationId,
				applied: fallbackApplied,
				non_null_visuals: countNonNullVisuals(),
				visual_target: visualTarget,
			});
		}
		if (countNonNullVisuals() < visualTarget) {
			logPracticeObs({
				phase: "practice_generation_visual_enrichment_missing",
				correlation_id: correlationId,
				non_null_visuals: countNonNullVisuals(),
				visual_target: visualTarget,
				needs_visual_true: visualIntentSummary.needs_visual_true,
				preferred_kind_count: jobContext.visuals.preferredKinds.length,
			});
		}
	}

	// Pass 2 — best-effort visual validator. Disabled by default
	// (PRACTICE_VISUAL_VALIDATOR=false). Even when enabled the pass is
	// best-effort: any error short-circuits to "no patches", Pass 1's
	// output still ships. See src/lib/practice/visuals/run-validator-pass.ts
	// for the full contract.
	const validatorResult = await runValidatorPass(fullOutput, {
		correlationId,
		userId: resolved.userId,
		generationRunId,
	});
	await writeGenerationStep({
		stepKey: "visual_validator",
		status: validatorResult.ok ? "ok" : "error",
		feature: "practice.generation.validator_pass",
		metadata: { patch_candidates: validatorResult.patches.length },
	});
	if (validatorResult.ok && validatorResult.patches.length > 0) {
		const patched = applyVisualPatches(fullOutput, validatorResult.patches);
		fullOutput.questions = patched.output.questions;
		logPracticeObs({
			phase: "practice_generation_visual_patches_applied",
			correlation_id: correlationId,
			applied: patched.applied,
			candidates: validatorResult.patches.length,
		});
	}
	const validatorNullIndexes = new Set<number>(
		validatorResult.patches.flatMap((patch) => patch.action === "null_visual" ? [patch.index] : []),
	);
	if (
		stemGroundingMode === "enforce" &&
		validatorResult.ok &&
		validatorNullIndexes.size > 0 &&
		jobContext.visuals.enabled &&
		jobContext.visuals.preferredKinds.length > 0 &&
		visualTarget > 0 &&
		countNonNullVisuals() < visualTarget
	) {
		const unresolvedNeededIndexes = selectVisualCandidateIndexes({
			round: "retry_2",
			questions: fullOutput.questions,
			decisions: visualIntentDecisions,
		});
		const recoveryCandidates = unresolvedNeededIndexes
			.filter((index) => validatorNullIndexes.has(index))
			.slice(0, enrichmentBatchSize);
		if (recoveryCandidates.length > 0) {
			const recoveryRequireAtLeastOneVisual = shouldRequireAtLeastOneVisual(
				recoveryCandidates,
				visualIntentDecisions,
			);
			const recoveryCandidateIntent = buildCandidateIntent(recoveryCandidates);
			const recoveryResult = await generateVisualEnrichmentPass({
				output: fullOutput,
				userId: resolved.userId,
				subjectName: resolved.subjectName,
				preferredKinds: jobContext.visuals.preferredKinds,
				evidenceByTopicId: jobContext.evidenceByTopicId,
				topicExemplarHint: jobContext.topicExemplarHint,
				templatePolicy: jobContext.visuals.templatePolicy,
				candidateIndexes: recoveryCandidates,
				candidateIntent: recoveryCandidateIntent,
				maxCandidateCount: recoveryCandidates.length,
				strictGrounding: true,
				requireAtLeastOneVisual: recoveryRequireAtLeastOneVisual,
				generationRunId,
				correlationId,
				abortSignal: opts.abortSignal,
			});
			await writeGenerationStep({
				stepKey: "visual_enrichment_recovery",
				status: recoveryResult.ok ? "ok" : "error",
				model: resolveChatModel("practice.generation.visual_enrichment").modelId,
				feature: "practice.generation.visual_enrichment",
				latencyMs: recoveryResult.modelMs,
				inputTokens: recoveryResult.inputTokens,
				outputTokens: recoveryResult.outputTokens,
				error: recoveryResult.ok ? null : "Visual recovery enrichment failed.",
				metadata: {
					candidate_indexes: recoveryCandidates.length,
					patch_candidates: recoveryResult.patches.length,
					target_non_null_visuals: visualTarget,
					before_non_null_visuals: countNonNullVisuals(),
				},
			});
			if (recoveryResult.ok && recoveryResult.patches.length > 0) {
				const recovered = applyVisualPatches(fullOutput, recoveryResult.patches);
				fullOutput.questions = recovered.output.questions;
				logPracticeObs({
					phase: "practice_generation_visual_enrichment_recovery_applied",
					correlation_id: correlationId,
					applied: recovered.applied,
					candidates: recoveryResult.patches.length,
					non_null_visuals: countNonNullVisuals(),
					visual_target: visualTarget,
				});

				const recoveryValidatorResult = await runValidatorPass(fullOutput, {
					correlationId,
					userId: resolved.userId,
					generationRunId,
				});
				await writeGenerationStep({
					stepKey: "visual_validator_recheck",
					status: recoveryValidatorResult.ok ? "ok" : "error",
					feature: "practice.generation.validator_pass",
					metadata: { patch_candidates: recoveryValidatorResult.patches.length },
				});
				if (recoveryValidatorResult.ok && recoveryValidatorResult.patches.length > 0) {
					const rechecked = applyVisualPatches(fullOutput, recoveryValidatorResult.patches);
					fullOutput.questions = rechecked.output.questions;
					logPracticeObs({
						phase: "practice_generation_visual_recovery_validator_patches_applied",
						correlation_id: correlationId,
						applied: rechecked.applied,
						candidates: recoveryValidatorResult.patches.length,
					});
				}
			}
		}
	}

	// 3-call variant: Flash structure+sanity validator before persist. Runs
	// only when PRACTICE_PIPELINE_VARIANT=3call. Fail-open by design — a
	// flaky validator must not block a passing test (the existing
	// deterministic Zod + quality gates already ran upstream). We capture
	// failed indexes as telemetry today; in a follow-up we can drive them
	// into the existing repair loop.
	if (getPracticePipelineVariant() === "3call") {
		const vT0 = Date.now();
		const v = await runPracticeValidationPass({
			output: fullOutput,
			expectedTypeCounts,
			allowedTopicIds: [...topicIdSet],
			studentUserId: resolved.userId,
			telemetry: {
				generationRunId,
				correlationId,
				stepKey: "post_assembly_validation",
			},
			abortSignal: opts.abortSignal,
		});
		await writeGenerationStep({
			stepKey: "post_assembly_validation",
			status: v.ok ? "ok" : "error",
			feature: "practice.generation.validation",
			latencyMs: Date.now() - vT0,
			inputTokens: v.inputTokens,
			outputTokens: v.outputTokens,
			error: v.ok ? null : v.message,
			metadata:
				v.ok ?
					{ variant: "3call" }
				:	{
						variant: "3call",
						failed_indexes: v.failedIndexes,
						issue_count: v.issues.length,
						issue_codes: [...new Set(v.issues.map((i) => i.code))],
					},
		});
		if (!v.ok) {
			logPracticeObs({
				phase: "practice_generation_validator_3call_flagged",
				correlation_id: correlationId,
				failed_indexes: v.failedIndexes,
				issue_count: v.issues.length,
			});
		}
	}

	const questionsPayload = sanitizeForPostgresJsonb(
		fullOutput.questions.map((q) => ({
			topic_id: q.topic_id,
			question_text: q.question_text,
			question_type: q.question_type,
			difficulty_level: q.difficulty_level,
			answer_key: q.answer_key,
			options: q.question_type === "multiple_choice" ? q.options : null,
			// Persist the structured visual envelope (or null) under
			// `questions.metadata.visual` per v2 visuals plan §4.3 — no DB
			// migration needed in v1; promote to a typed column in Phase 4.
			//
			// Also persist `cognitive_demand` (Bloom-level) and `marks` (CBSE
			// convention 1-5) inside metadata so analytics can slice tests by
			// cognitive distribution and marking weight without an extra LLM
			// inference pass. Both are optional in the Zod schema — store
			// `null` rather than omit so dashboards don't see undefined.
			metadata: {
				visual: q.visual ?? null,
				cognitive_demand: q.cognitive_demand ?? null,
				marks: q.marks ?? null,
			},
		})),
	);

	const rpcT0 = Date.now();
	let newTestId: unknown = null;
	let rpcErr: PracticePersistRpcError | null = null;
	let rpcAttempts = 0;
	for (let attempt = 1; attempt <= PRACTICE_PERSIST_MAX_ATTEMPTS; attempt++) {
		rpcAttempts = attempt;
		const result =
			opts.persistGeneratedTest ?
				await opts.persistGeneratedTest({
					subjectId,
					difficulty,
					durationSeconds,
					questionCount: totalQ,
					questionMix: questionMixJson,
					questions: questionsPayload,
				})
			:	await supabase.rpc("practice_generate_test", {
					p_subject_id: subjectId,
					p_difficulty: difficulty,
					p_duration_seconds: durationSeconds,
					p_question_count: totalQ,
					p_question_mix: questionMixJson,
					p_questions: questionsPayload,
				});
		newTestId = result.data;
		rpcErr = result.error;
		if (!rpcErr && newTestId) break;
		if (!isRetryablePracticePersistError(rpcErr) || attempt === PRACTICE_PERSIST_MAX_ATTEMPTS) break;
		await wait(750 * attempt);
	}
	timingsMs.rpcPersist = Date.now() - rpcT0;
	await writeGenerationStep({
		stepKey: "persist_test_rpc",
		status: rpcErr || !newTestId ? "error" : "ok",
		latencyMs: timingsMs.rpcPersist,
		error: rpcErr ? rpcErr.message : null,
		metadata: {
			attempts: rpcAttempts,
			question_count: totalQ,
		},
	});

	if (rpcErr || !newTestId) {
		if (rpcErr) {
			logSupabaseError("generatePracticeTest.practice_generate_test", rpcErr, { correlationId });
		}
		logPracticeObs({
			phase: "practice_generation",
			correlation_id: correlationId,
			ok: false,
			code: "database_error",
			durationMs: Date.now() - pipelineT0,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
			},
		});
		if (generationRunId) {
			await finishGenerationRun({
				runId: generationRunId,
				status: "failed",
				failureCode: "database_error",
				failureMessage: rpcErr?.message ?? "Could not create the test session.",
				timingsMs: {
					...timingsMs,
					modelMs: cumulativeModelMs,
					validationMs: cumulativeValidationMs,
					totalDurationMs: Date.now() - pipelineT0,
				},
			});
		}
		void recordPracticeEvent(
			supabase,
			"practice_generation_failed",
			{
				code: "database_error",
				message: rpcErr?.message ?? "Could not create the test session.",
				correlation_id: correlationId,
				generation_run_id: generationRunId,
			},
			{ studentId: resolved.userId },
		);
		return {
			ok: false,
			code: "database_error",
			message: "Could not create the test session.",
		};
	}

	const testId = newTestId as string;

	void recordPracticeEvent(
		supabase,
		"practice_generation_succeeded",
		{
			test_id: testId,
			subject_id: subjectId,
			question_count: totalQ,
			topic_count: resolved.canonicalTopics.length,
			correlation_id: correlationId,
			generation_run_id: generationRunId,
		},
		{ studentId: resolved.userId },
	);
	if (generationRunId) {
		await attachTestIdToRunAiCalls(generationRunId, testId);
	}

	// `questions.embedding` is no longer populated post-DeepSeek migration. The
	// column is preserved for now to avoid a destructive backfill; see plan §11
	// step 25 for the column drop.

	logPracticeObs({
		phase: "practice_generation_complete",
		correlation_id: correlationId,
		testId,
		ok: true,
		durationMs: Date.now() - pipelineT0,
		timingsMs: {
			...timingsMs,
			modelMs: cumulativeModelMs,
			validationMs: cumulativeValidationMs,
		},
		questionCount: totalQ,
		topicCount: resolved.canonicalTopics.length,
	});
	if (generationRunId) {
		await finishGenerationRun({
			runId: generationRunId,
			status: "succeeded",
			testId,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
				totalDurationMs: Date.now() - pipelineT0,
			},
		});
	}

	const finalPublic = validateAndStripGeneration(fullOutput, expectedCount, topicIdSet, {
		expectedDurationSeconds: durationSeconds,
		expectedTypeCounts,
	});
	const publicResult = finalPublic.ok ? finalPublic : stripped;

	return {
		ok: true,
		testId,
		subjectName: resolved.subjectName,
		questions: publicResult.ok ? publicResult.questions : [],
		generation_metadata: publicResult.ok
			? publicResult.generation_metadata
			: {
					topic_distribution: {},
					difficulty_distribution: {},
					type_distribution: {},
					adaptation_rationale: "",
				},
	};
}

/** Validate body for API route / server action. */
/**
 * Visual-heavy chapter keywords. When ANY generated question's `topic_name`
 * contains one of these substrings (case-insensitive), the visual-floor
 * observability counter expects the blueprint to have flagged at least
 * `floor(0.25 × total)` slots (minimum 4) as `needs_visual=true`.
 *
 * Observation-only today — the un-met-floor case logs to `practice_obs`
 * but the run still proceeds. Once we have ≥2 weeks of data on how often
 * the prompt-level floor instruction is honoured, we can decide whether to
 * promote this to a deterministic enforcement step in the blueprint.
 */
const VISUAL_HEAVY_CHAPTER_KEYWORDS = [
	"coordinate geometry",
	"conic sections",
	"straight lines",
	"trigonometric functions",
	"three dimensional geometry",
	"three-dimensional geometry",
	"frequency distribution",
	"bivariate frequency",
	"correlation",
	"diagrammatic presentation",
	"probability distributions",
	"circuits",
	"free-body",
	"free body",
	"optics",
	"waves",
	"molecular",
];

function countVisualHeavyTopicMatches(
	questions: ReadonlyArray<{ topic_name?: string | null }>,
): number {
	let hits = 0;
	for (const q of questions) {
		const name = (q.topic_name ?? "").toLowerCase();
		if (!name) continue;
		for (const kw of VISUAL_HEAVY_CHAPTER_KEYWORDS) {
			if (name.includes(kw)) {
				hits += 1;
				break;
			}
		}
	}
	return hits;
}

export function safeParseGenerationInput(input: unknown) {
	return finalizePracticeConfigSchema.safeParse(input);
}
