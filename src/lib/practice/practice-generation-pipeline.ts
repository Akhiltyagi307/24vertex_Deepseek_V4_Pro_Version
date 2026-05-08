import { randomUUID } from "node:crypto";

import { APICallError, generateObject, NoObjectGeneratedError, streamObject } from "ai";

import {
	insertHeuristicModerationFlag,
	moderatePracticeGenerationText,
	moderatePracticeQuestionsPerItem,
} from "@/lib/ai/moderation";
import { recordAiCall } from "@/lib/ai/record-ai-call";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { getOpenAIChatModel, getOpenAIChatModelFallback } from "@/lib/env";
import { preflightPracticeTestQuota } from "@/lib/billing/entitlements";
import {
	mapResolveToGenerateFailure,
	type GeneratePracticeFailure,
	type GeneratePracticeResult,
} from "../../../app/student/practice/actions/types";
import {
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
} from "@/lib/practice";
import {
	getPracticeQuestionPlan,
	getPracticeQuestionPlanForSubject,
	practiceTypeCountsToQuestionMixJson,
	type PracticeQuestionTypeCounts,
} from "@/lib/practice/constants";
import {
	buildPracticeGenerationRepairSystemPrompt,
	buildPracticeGenerationRepairUserPrompt,
} from "@/lib/practice/practice-generation-repair";
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { tagTopicContextTruncated, withPracticeSpan } from "@/lib/practice/sentry-tags";
import { repeatPracticeAiResultUntilSuccessOrExhausted } from "@/lib/practice/ai-retry";
import { consumeGenerationRateLimit } from "@/lib/practice/practice-rate-limit";
import {
	embedQuestionTexts,
	findDuplicatesAgainstStudent,
	persistQuestionEmbeddings,
} from "@/lib/practice/dedup-embeddings";
import { finalizePracticeConfigSchema, type FinalizePracticeConfigInput } from "@/lib/practice/schemas";
import type { PracticeConfigResolveSuccess } from "@/lib/practice/resolve-config";
import { logPracticeObs, newPracticeCorrelationId } from "@/lib/server/practice-observability";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
type ServerSupabase = SupabaseClient;

export type RunGenerationPipelineOptions = {
	useStreamObject: boolean;
	/** Fires for each partial object when `useStreamObject` is true. */
	onPartialObject?: (partial: unknown) => void;
	/** Cancel the OpenAI HTTP call (and downstream model retries) when fired. */
	abortSignal?: AbortSignal;
};

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
 * Strict JSON-schema mode for generation. Off by default because the practice
 * generation schema uses `z.array().length(N)` and `z.null().optional()`,
 * patterns that don't reliably satisfy OpenAI's strict-mode contract — turning
 * it on globally has historically caused 100% generation failure on some model
 * versions. Set `PRACTICE_STRICT_JSON_SCHEMA_GENERATE=true` in non-prod to test.
 */
function isStrictJsonSchemaForGenerationEnabled(): boolean {
	return process.env.PRACTICE_STRICT_JSON_SCHEMA_GENERATE === "true";
}

/**
 * Errors that should trigger a fallback-model retry (not the same model
 * with `maxRetries`). Capacity / rate-limit / overload errors typically
 * persist for many seconds, so retrying the same model just delays a hard
 * fail; trying a different model recovers immediately.
 */
function isRetryableForFallback(e: unknown): boolean {
	if (APICallError.isInstance(e)) {
		const code = e.statusCode;
		if (code === 429 || code === 503 || code === 504) return true;
	}
	if (e instanceof Error && /\b(rate[ -]?limit|overloaded|timeout|capacity)\b/i.test(e.message)) {
		return true;
	}
	return false;
}

async function runModelOnce(
	systemPrompt: string,
	userPrompt: string,
	estimatedQuestionCount: number,
	outputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>,
	opts: Pick<RunGenerationPipelineOptions, "useStreamObject" | "onPartialObject" | "abortSignal">,
	studentUserId: string,
	chatModelId: string = getOpenAIChatModel(),
): Promise<{ ok: true; object: PracticeGenerationGroupedOutput } | { ok: false; message: string; error: unknown }> {
	// Hard-cap output tokens at 12k regardless of question count. The previous
	// scaling could request up to 32k for high-question tests, which exceeds
	// per-request limits on some models and produces unpredictable cost. 12k
	// fits a 40-question schema comfortably.
	const maxOutputTokens = Math.min(12_000, Math.max(6_000, estimatedQuestionCount * 900));
	const model = getOpenAIProvider()(chatModelId);
	const baseParams = {
		model,
		schema: outputSchema,
		system: systemPrompt,
		prompt: userPrompt,
		maxOutputTokens,
		maxRetries: 2,
		abortSignal: opts.abortSignal,
		providerOptions: {
			openai: {
				strictJsonSchema: isStrictJsonSchemaForGenerationEnabled(),
			},
		},
	};

	if (opts.useStreamObject) {
		try {
			const t0 = Date.now();
			const result = streamObject(baseParams);
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
			void recordAiCall({
				feature: "practice.generation",
				model: chatModelId,
				userId: studentUserId,
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				latencyMs: Date.now() - t0,
				status: "ok",
			});
			return { ok: true, object: object as PracticeGenerationGroupedOutput };
		} catch (e) {
			logServerError("runPracticeGeneration.streamObject", e);
			return {
				ok: false,
				message: `Could not generate the test. ${formatGenerationError(e)}`,
				error: e,
			};
		}
	}

	try {
		const t0 = Date.now();
		const { object, usage } = await generateObject(baseParams);
		void recordAiCall({
			feature: "practice.generation",
			model: chatModelId,
			userId: studentUserId,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});
		return { ok: true, object: object as PracticeGenerationGroupedOutput };
	} catch (e) {
		logServerError("generatePracticeTest.generateObject", e);
		return {
			ok: false,
			message: `Could not generate the test. ${formatGenerationError(e)}`,
			error: e,
		};
	}
}

/**
 * Runs the primary model; on capacity / overload / 429, retries once with
 * the configured fallback model (if any). Logs which model produced the
 * eventual result for observability.
 */
async function runModelOnceWithFallback(
	systemPrompt: string,
	userPrompt: string,
	estimatedQuestionCount: number,
	outputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>,
	opts: Pick<RunGenerationPipelineOptions, "useStreamObject" | "onPartialObject" | "abortSignal">,
	studentUserId: string,
): Promise<{ ok: true; object: PracticeGenerationGroupedOutput } | { ok: false; message: string }> {
	const primary = getOpenAIChatModel();
	const first = await runModelOnce(
		systemPrompt,
		userPrompt,
		estimatedQuestionCount,
		outputSchema,
		opts,
		studentUserId,
		primary,
	);
	if (first.ok) return first;

	const fallback = getOpenAIChatModelFallback();
	if (!fallback || !isRetryableForFallback(first.error)) {
		return { ok: false, message: first.message };
	}
	logServerError(
		"generatePracticeTest.modelFallback",
		`Primary model ${primary} failed retryably; retrying with fallback ${fallback}.`,
		{ primaryError: first.message },
	);
	const second = await runModelOnce(
		systemPrompt,
		userPrompt,
		estimatedQuestionCount,
		outputSchema,
		opts,
		studentUserId,
		fallback,
	);
	if (second.ok) return second;
	return { ok: false, message: second.message };
}

function isPracticeGenerationRepairEnabled(): boolean {
	return process.env.PRACTICE_GENERATION_REPAIR?.trim().toLowerCase() !== "false";
}

async function runPracticeGenerationRepairGrouped(params: {
	failedGrouped: PracticeGenerationGroupedOutput;
	validationMessage: string;
	durationSeconds: number;
	expectedTypeCounts: PracticeQuestionTypeCounts;
	allowedTopicIds: string[];
	generationOutputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>;
	estimatedQuestionCount: number;
	studentUserId: string;
	abortSignal?: AbortSignal;
}): Promise<
	{ ok: true; object: PracticeGenerationGroupedOutput; modelMs: number } | { ok: false; message: string; modelMs: number }
> {
	const repairUser = buildPracticeGenerationRepairUserPrompt({
		validationMessage: params.validationMessage,
		timeLimitSeconds: params.durationSeconds,
		timeSumMin: Math.round(params.durationSeconds * 0.6),
		timeSumMax: Math.round(params.durationSeconds * 1.2),
		allowedTopicIds: params.allowedTopicIds,
		questionTypeCounts: params.expectedTypeCounts,
		failedGroupedJson: JSON.stringify(params.failedGrouped),
	});
	const t0 = Date.now();
	try {
		const { object, usage } = await generateObject({
			model: getOpenAIProvider()(getOpenAIChatModel()),
			schema: params.generationOutputSchema,
			system: buildPracticeGenerationRepairSystemPrompt(),
			prompt: repairUser,
			maxOutputTokens: Math.min(12_000, Math.max(6_000, params.estimatedQuestionCount * 900)),
			maxRetries: 2,
			abortSignal: params.abortSignal,
			providerOptions: {
				openai: { strictJsonSchema: isStrictJsonSchemaForGenerationEnabled() },
			},
		});
		void recordAiCall({
			feature: "practice.generation.repair",
			model: getOpenAIChatModel(),
			userId: params.studentUserId,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});
		return { ok: true, object: object as PracticeGenerationGroupedOutput, modelMs: Date.now() - t0 };
	} catch (e) {
		logServerError("runPracticeGenerationRepairGrouped", e);
		void recordAiCall({
			feature: "practice.generation.repair",
			model: getOpenAIChatModel(),
			userId: params.studentUserId,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: Date.now() - t0,
			status: "error",
			error: formatGenerationError(e),
		});
		return { ok: false, message: formatGenerationError(e), modelMs: Date.now() - t0 };
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

	void recordPracticeEvent(
		supabase,
		"practice_generate_clicked",
		{
			subject_id: parsed.subjectId,
			difficulty: parsed.difficulty,
			duration_seconds: parsed.durationSeconds,
			question_count: getPracticeQuestionPlan(parsed.durationSeconds).total,
			topic_count: resolved.canonicalTopics.length,
		},
		{ studentId: resolved.userId },
	);

	const { subjectId, difficulty, durationSeconds } = parsed;
	// Mathematics subjects collapse to all-MCQ regardless of duration mix —
	// open-ended math grading is unreliable at scale and the curriculum exam
	// pattern is overwhelmingly MCQ-driven.
	const plan = getPracticeQuestionPlanForSubject(durationSeconds, resolved.subjectName);
	const expectedTypeCounts = plan.counts;
	const questionMixJson = practiceTypeCountsToQuestionMixJson(plan.counts);
	const generationOutputSchema = createPracticeGenerationOutputSchema(expectedTypeCounts);

	const topicIds = resolved.canonicalTopics.map((t) => t.topicId);
	const admin = createServiceRoleClient();
	const tc0 = Date.now();
	const preFetchedTopicContext = await fetchTopicContextChunksByTopicIds(admin, topicIds);
	timingsMs.topicContextFetch = Date.now() - tc0;

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

	const gmeta = preFetchedTopicContext.meta;
	if (!gmeta.fetch_error && gmeta.topic_count > 0 && gmeta.context_chunk_count === 0 && gmeta.exercise_chunk_count === 0) {
		void recordPracticeEvent(
			supabase,
			"practice_topic_context_empty",
			{ topic_count: gmeta.topic_count },
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
			},
			{ studentId: resolved.userId },
		);
		void tagTopicContextTruncated();
	}

	const systemPrompt = buildPracticeSystemPrompt({
		userMessageSummary: {
			schema_version: userPayload.schema_version,
			intent: userPayload.intent,
			test_parameters: userPayload.test_parameters,
			constraints: userPayload.constraints,
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

	async function generateAndStrip(): Promise<
		| { ok: true; object: PracticeGenerationOutput; public: ReturnType<typeof validateAndStripGeneration> }
		| { ok: false; message: string; code: GeneratePracticeFailure["code"] }
	> {
		const m0 = Date.now();
		const r = await runModelOnceWithFallback(
			systemPrompt,
			userPrompt,
			expectedCount,
			generationOutputSchema,
			opts,
			resolved.userId,
		);
		cumulativeModelMs += Date.now() - m0;
		if (!r.ok) return { ok: false, message: r.message, code: "generation_failed" };

		let grouped: PracticeGenerationGroupedOutput = normalizeGroupedEstimatedTimesToPlan(
			r.object,
			durationSeconds,
		);

		const v0 = Date.now();
		let flattened = flattenPracticeGenerationOutput(grouped);
		let out = validateAndStripGeneration(flattened, expectedCount, topicIdSet, {
			expectedDurationSeconds: durationSeconds,
			expectedTypeCounts,
		});

		if (!out.ok && isPracticeGenerationRepairEnabled()) {
			const repaired = await runPracticeGenerationRepairGrouped({
				failedGrouped: grouped,
				validationMessage: out.message,
				durationSeconds,
				expectedTypeCounts,
				allowedTopicIds: [...topicIdSet],
				generationOutputSchema,
				estimatedQuestionCount: expectedCount,
				studentUserId: resolved.userId,
				abortSignal: opts.abortSignal,
			});
			cumulativeModelMs += repaired.modelMs;
			if (repaired.ok) {
				grouped = normalizeGroupedEstimatedTimesToPlan(repaired.object, durationSeconds);
				flattened = flattenPracticeGenerationOutput(grouped);
				out = validateAndStripGeneration(flattened, expectedCount, topicIdSet, {
					expectedDurationSeconds: durationSeconds,
					expectedTypeCounts,
				});
			}
		}

		cumulativeValidationMs += Date.now() - v0;
		if (!out.ok) {
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

		// Hybrid moderation:
		// 1) Per-question regex/profanity (free) — flags individual bad items
		//    so a single tainted question can't kill the whole generation.
		// 2) Blob-level pass for the embedding rule (paid only when admins
		//    seed embedding patterns in `content_blacklist`).
		const perItem = await moderatePracticeQuestionsPerItem(
			flattened.questions.map((q) => q.question_text),
		);
		if (!perItem.ok) {
			// If too many items are flagged, regenerate the whole test rather
			// than ship a too-short test. Otherwise we accept losing a few.
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
			// Drop flagged questions so the rest of the test is preserved.
			const dropSet = new Set(perItem.flagged.map((f) => f.index));
			flattened.questions = flattened.questions.filter((_, i) => !dropSet.has(i));
		}

		const modBlob = JSON.stringify(flattened.questions);
		const mod = await moderatePracticeGenerationText(modBlob);
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

		return { ok: true, object: flattened, public: out };
	}

	let stripped!: ReturnType<typeof validateAndStripGeneration>;
	const attempt = await repeatPracticeAiResultUntilSuccessOrExhausted<PracticeGenerationOutput>(
		"generatePracticeTest",
		async () => {
			const r = await generateAndStrip();
			if (!r.ok) return { ok: false, message: r.message };
			stripped = r.public;
			return { ok: true, value: r.object };
		},
		{
			onFailedAttempt: (failure, attemptNumber, totalAttempts) => {
				logServerError("generatePracticeTest.retry", failure.message, {
					subjectId,
					durationSeconds,
					attemptNumber,
					totalAttempts,
					correlationId,
				});
			},
		},
	);
	if (!attempt.ok) {
		logPracticeObs({
			phase: "practice_generation",
			correlationId,
			ok: false,
			code: "generation_failed",
			durationMs: Date.now() - pipelineT0,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
			},
		});
		return { ok: false, code: "generation_failed", message: attempt.message };
	}
	if (!stripped || !stripped.ok) {
		logPracticeObs({
			phase: "practice_generation",
			correlationId,
			ok: false,
			code: "generation_invalid",
			durationMs: Date.now() - pipelineT0,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
			},
		});
		return {
			ok: false,
			code: "generation_invalid",
			message: "The generator output could not be validated.",
		};
	}

	const fullOutput = attempt.value;
	const totalQ = fullOutput.questions.length;

	// Generation-time dedup is OFF by default (set 2026-05): the product
	// requirement is that students MUST see important questions, even if
	// they've appeared in a past test. Earlier behavior regenerated whole
	// tests when ≥1 question matched a past one ≥0.92 cosine similarity,
	// which silently removed high-value questions on repeat practice.
	// Set PRACTICE_DEDUP_MAX_REGENS=1 (or higher) to re-enable.
	const dedupThreshold = Number.parseInt(process.env.PRACTICE_DEDUP_MAX_REGENS ?? "0", 10);
	if (Number.isFinite(dedupThreshold) && dedupThreshold > 0) {
		const dedupT0 = Date.now();
		try {
			const texts = fullOutput.questions.map((q) => q.question_text);
			const embeddings = await embedQuestionTexts(texts, { userId: resolved.userId });
			const dupes = await findDuplicatesAgainstStudent(
				supabase,
				resolved.userId,
				fullOutput.questions.map((q) => ({ topic_id: q.topic_id, question_text: q.question_text })),
				embeddings,
			);
			if (dupes.length > 0) {
				logPracticeObs({
					phase: "generation_dedup_regen",
					correlation_id: correlationId,
					duplicates: dupes.length,
				});
				const regen = await generateAndStrip();
				if (regen.ok) {
					stripped = regen.public;
					(fullOutput as PracticeGenerationOutput).questions = regen.object.questions;
					(fullOutput as PracticeGenerationOutput).generation_metadata = regen.object.generation_metadata;
				}
			}
			(fullOutput as PracticeGenerationOutput & { __embeddings?: number[][] }).__embeddings = embeddings;
		} catch (e) {
			logServerError("generatePracticeTest.dedupEmbeddings", e, {
				subjectId,
				correlationId,
			});
		} finally {
			timingsMs.dedup = Date.now() - dedupT0;
		}
	}

	const questionsPayload = fullOutput.questions.map((q) => ({
		topic_id: q.topic_id,
		question_text: q.question_text,
		question_type: q.question_type,
		difficulty_level: q.difficulty_level,
		answer_key: q.answer_key,
		options: q.question_type === "multiple_choice" ? q.options : null,
		metadata: {},
	}));

	const rpcT0 = Date.now();
	const { data: newTestId, error: rpcErr } = await supabase.rpc("practice_generate_test", {
		p_subject_id: subjectId,
		p_difficulty: difficulty,
		p_duration_seconds: durationSeconds,
		p_question_count: totalQ,
		p_question_mix: questionMixJson,
		p_questions: questionsPayload,
	});
	timingsMs.rpcPersist = Date.now() - rpcT0;

	if (rpcErr || !newTestId) {
		if (rpcErr) {
			logSupabaseError("generatePracticeTest.practice_generate_test", rpcErr, { correlationId });
		}
		logPracticeObs({
			phase: "practice_generation",
			correlationId,
			ok: false,
			code: "database_error",
			durationMs: Date.now() - pipelineT0,
			timingsMs: {
				...timingsMs,
				modelMs: cumulativeModelMs,
				validationMs: cumulativeValidationMs,
			},
		});
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
		},
		{ studentId: resolved.userId },
	);

	const embeddings = (fullOutput as PracticeGenerationOutput & { __embeddings?: number[][] }).__embeddings;
	if (embeddings && embeddings.length === totalQ) {
		void (async () => {
			try {
				const adminC = createServiceRoleClient();
				const { data: qRows } = await adminC
					.from("questions")
					.select("id, question_number")
					.eq("test_id", testId)
					.order("question_number", { ascending: true });
				if (qRows?.length === totalQ) {
					await persistQuestionEmbeddings(
						adminC,
						qRows
							.map((r, i) => ({
								question_id: r.id as string,
								embedding: embeddings[i] ?? [],
							}))
							.filter((x) => x.embedding.length > 0),
					);
				}
			} catch (e) {
				logServerError("generatePracticeTest.persistQuestionEmbeddings", e, {
					testId,
					correlationId,
				});
			}
		})().catch((e) => {
			logServerError("generatePracticeTest.persistQuestionEmbeddings.unhandled", e, { testId, correlationId });
		});
	}

	logPracticeObs({
		phase: "practice_generation_complete",
		correlationId,
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

	return {
		ok: true,
		testId,
		subjectName: resolved.subjectName,
		questions: stripped.ok ? stripped.questions : [],
		generation_metadata: stripped.ok
			? stripped.generation_metadata
			: {
					topic_distribution: {},
					difficulty_distribution: {},
					type_distribution: {},
					adaptation_rationale: "",
				},
	};
}

/** Validate body for API route / server action. */
export function safeParseGenerationInput(input: unknown) {
	return finalizePracticeConfigSchema.safeParse(input);
}
