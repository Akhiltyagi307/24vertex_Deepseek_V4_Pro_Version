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

type PracticeQuestion = PracticeGenerationOutput["questions"][number];
type PracticeQuestionType = PracticeQuestion["question_type"];

const DEFAULT_GENERATION_BUDGET_MS = 300_000;
const MIN_BUDGET_FOR_MODEL_ATTEMPT_MS = 22_000;
const MIN_BUDGET_FOR_REPAIR_MS = 16_000;

function getGenerationBudgetMs(): number {
	const raw = Number.parseInt(process.env.PRACTICE_GENERATION_BUDGET_MS ?? "", 10);
	if (!Number.isFinite(raw) || raw < 30_000) return DEFAULT_GENERATION_BUDGET_MS;
	return raw;
}

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
 * Strict JSON-schema mode for generation. ON by default. Disable via
 * `PRACTICE_STRICT_JSON_SCHEMA_GENERATE=false` if a future model regresses.
 */
function isStrictJsonSchemaForGenerationEnabled(): boolean {
	return process.env.PRACTICE_STRICT_JSON_SCHEMA_GENERATE !== "false";
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
	let generationAttemptCount = 0;
	let repairAttemptCount = 0;
	let moderationReplacementCount = 0;
	const generationBudgetMs = getGenerationBudgetMs();
	const remainingBudgetMs = () => Math.max(0, generationBudgetMs - (Date.now() - pipelineT0));
	const hasRemainingBudget = (minimumMs: number) => remainingBudgetMs() >= minimumMs;
	const generationTimedOutMessage =
		"Generation timed out before a safe retry could start. Please try again.";
	const withCorrelationFailure = (
		code: GeneratePracticeFailure["code"],
		message: string,
	): Extract<GeneratePracticeResult, { ok: false }> => ({
		ok: false,
		code,
		message,
		correlationId,
	});

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
	const emptyTypeCounts = (): PracticeQuestionTypeCounts => ({
		multiple_choice: 0,
		fill_in_blank: 0,
		short_answer: 0,
		long_answer: 0,
	});

	function buildModerationReplacementPrompt(args: {
		baseUserPrompt: string;
		replacementCounts: PracticeQuestionTypeCounts;
		allowedTopicIds: string[];
		preferredTopicIds: string[];
		blockedQuestionTexts: string[];
	}): string {
		return [
			args.baseUserPrompt,
			"",
			"MODERATION_REPLACEMENT_MODE:",
			"- Generate ONLY replacement questions to fill moderation-filtered slots.",
			"- Preserve pedagogy and exam style; do not include policy/safety commentary.",
			"- Use only topic_id values from ALLOWED_TOPIC_IDS.",
			"- Prefer topic_id values from PREFERRED_TOPIC_IDS where feasible.",
			"- Avoid repeating blocked question stems listed in BLOCKED_QUESTION_TEXTS.",
			"REQUIRED_BUCKET_LENGTHS (questions_by_type.*.length):",
			JSON.stringify(args.replacementCounts),
			"ALLOWED_TOPIC_IDS:",
			JSON.stringify(args.allowedTopicIds),
			"PREFERRED_TOPIC_IDS:",
			JSON.stringify(args.preferredTopicIds),
			"BLOCKED_QUESTION_TEXTS:",
			JSON.stringify(args.blockedQuestionTexts.slice(0, 12)),
		].join("\n");
	}

	async function replaceModeratedQuestions(args: {
		flattened: PracticeGenerationOutput;
		flaggedIndices: number[];
	}): Promise<
		| { ok: true; mergedOutput: PracticeGenerationOutput; public: ReturnType<typeof validateAndStripGeneration> }
		| { ok: false; message: string }
	> {
		const flaggedIndexSet = new Set(args.flaggedIndices);
		const replacementCounts = emptyTypeCounts();
		const preferredTopicIds = new Set<string>();
		const blockedQuestionTexts: string[] = [];
		for (const idx of flaggedIndexSet) {
			const q = args.flattened.questions[idx];
			if (!q) continue;
			replacementCounts[q.question_type]++;
			preferredTopicIds.add(q.topic_id);
			blockedQuestionTexts.push(q.question_text);
		}
		const replacementTotal = Object.values(replacementCounts).reduce((sum, n) => sum + n, 0);
		if (replacementTotal <= 0) {
			return { ok: false, message: "Moderation replacement failed: no flagged questions to replace." };
		}
		if (!hasRemainingBudget(MIN_BUDGET_FOR_MODEL_ATTEMPT_MS)) {
			return { ok: false, message: generationTimedOutMessage };
		}

		const replacementSchema = createPracticeGenerationOutputSchema(replacementCounts);
		const replacementPrompt = buildModerationReplacementPrompt({
			baseUserPrompt: userPrompt,
			replacementCounts,
			allowedTopicIds: [...topicIdSet],
			preferredTopicIds: [...preferredTopicIds],
			blockedQuestionTexts,
		});
		const replacementT0 = Date.now();
		const replacementRun = await runModelOnceWithFallback(
			systemPrompt,
			replacementPrompt,
			replacementTotal,
			replacementSchema,
			opts,
			resolved.userId,
		);
		cumulativeModelMs += Date.now() - replacementT0;
		if (!replacementRun.ok) {
			return { ok: false, message: replacementRun.message };
		}
		const replacementFlat = flattenPracticeGenerationOutput(replacementRun.object);
		const replacementOut = validateAndStripGeneration(replacementFlat, replacementTotal, topicIdSet, {
			expectedTypeCounts: replacementCounts,
		});
		if (!replacementOut.ok) {
			return { ok: false, message: replacementOut.message };
		}

		const replacementPerItem = await moderatePracticeQuestionsPerItem(
			replacementFlat.questions.map((q) => q.question_text),
		);
		if (!replacementPerItem.ok) {
			return { ok: false, message: "Replacement questions failed moderation checks." };
		}
		const replacementBlob = await moderatePracticeGenerationText(JSON.stringify(replacementFlat.questions));
		if (!replacementBlob.ok) {
			return { ok: false, message: "Replacement questions failed moderation checks." };
		}

		const byType: Record<PracticeQuestionType, PracticeQuestion[]> = {
			multiple_choice: [],
			fill_in_blank: [],
			short_answer: [],
			long_answer: [],
		};
		for (const q of replacementFlat.questions) {
			byType[q.question_type].push(q);
		}
		let missingByType = false;
		const mergedQuestions: PracticeQuestion[] = args.flattened.questions.map((q, idx) => {
			if (!flaggedIndexSet.has(idx)) return q;
			const next = byType[q.question_type].shift();
			if (!next) {
				missingByType = true;
				return q;
			}
			return next;
		});
		if (missingByType) {
			return { ok: false, message: "Replacement generation returned too few questions for at least one type." };
		}
		for (const type of Object.keys(byType) as PracticeQuestionType[]) {
			if (byType[type].length > 0) {
				return { ok: false, message: "Replacement generation returned an unexpected question mix." };
			}
		}

		const mergedOutput: PracticeGenerationOutput = {
			questions: mergedQuestions.map((q, idx) => ({ ...q, question_number: idx + 1 })),
			generation_metadata: args.flattened.generation_metadata,
		};
		const mergedOut = validateAndStripGeneration(mergedOutput, expectedCount, topicIdSet, {
			expectedDurationSeconds: durationSeconds,
			expectedTypeCounts,
		});
		if (!mergedOut.ok) {
			return { ok: false, message: mergedOut.message };
		}
		const mergedBlob = await moderatePracticeGenerationText(JSON.stringify(mergedOutput.questions));
		if (!mergedBlob.ok) {
			return { ok: false, message: "Output blocked by moderation filters." };
		}
		return { ok: true, mergedOutput, public: mergedOut };
	}

	async function generateAndStrip(): Promise<
		| { ok: true; object: PracticeGenerationOutput; public: ReturnType<typeof validateAndStripGeneration> }
		| { ok: false; message: string; code: GeneratePracticeFailure["code"] }
	> {
		generationAttemptCount++;
		if (!hasRemainingBudget(MIN_BUDGET_FOR_MODEL_ATTEMPT_MS)) {
			return { ok: false, message: generationTimedOutMessage, code: "generation_failed" };
		}
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
			if (hasRemainingBudget(MIN_BUDGET_FOR_REPAIR_MS)) {
				repairAttemptCount++;
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
			} else {
				logServerError("generatePracticeTest.repair.skipped_budget", out.message, {
					subjectId,
					durationSeconds,
					correlationId,
					generationAttemptCount,
					remainingBudgetMs: remainingBudgetMs(),
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
				generationAttemptCount,
				repairAttemptCount,
				remainingBudgetMs: remainingBudgetMs(),
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
			const replacement = await replaceModeratedQuestions({
				flattened,
				flaggedIndices: perItem.flagged.map((f) => f.index),
			});
			if (!replacement.ok) {
				return {
					ok: false,
					message: replacement.message,
					code: "generation_invalid",
				};
			}
			moderationReplacementCount += perItem.flagged.length;
			flattened = replacement.mergedOutput;
			out = replacement.public;
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
					repairAttemptCount,
					remainingBudgetMs: remainingBudgetMs(),
				});
			},
			shouldRetry: (_failure, attemptNumber, totalAttempts) => {
				if (attemptNumber >= totalAttempts) return false;
				const canRetry = hasRemainingBudget(MIN_BUDGET_FOR_MODEL_ATTEMPT_MS);
				if (!canRetry) {
					logServerError(
						"generatePracticeTest.retry.skipped_budget",
						"Skipping retry because the remaining generation budget is too low.",
						{
							subjectId,
							durationSeconds,
							correlationId,
							attemptNumber,
							totalAttempts,
							remainingBudgetMs: remainingBudgetMs(),
						},
					);
				}
				return canRetry;
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
				generationAttemptCount,
				repairAttemptCount,
				moderationReplacementCount,
				remainingBudgetMs: remainingBudgetMs(),
			},
		});
		return withCorrelationFailure("generation_failed", attempt.message);
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
				generationAttemptCount,
				repairAttemptCount,
				moderationReplacementCount,
				remainingBudgetMs: remainingBudgetMs(),
			},
		});
		return withCorrelationFailure("generation_invalid", "The generator output could not be validated.");
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
				generationAttemptCount,
				repairAttemptCount,
				moderationReplacementCount,
				remainingBudgetMs: remainingBudgetMs(),
			},
		});
		return withCorrelationFailure("database_error", "Could not create the test session.");
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
			generationAttemptCount,
			repairAttemptCount,
			moderationReplacementCount,
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
