import { APICallError, generateObject, NoObjectGeneratedError, streamObject } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { getOpenAIChatModel } from "@/lib/env";
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
	resolvePracticeConfigForStudent,
	summarizeGroupedQuestionTypeCounts,
	stringifyPracticeUserMessageForModel,
	validateAndStripGeneration,
	type PracticeGenerationGroupedOutput,
	type PracticeGenerationOutput,
} from "@/lib/practice";
import { getPracticeQuestionPlan, practiceTypeCountsToQuestionMixJson } from "@/lib/practice/constants";
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

	const resolved = await resolvePracticeConfigForStudent(supabase, parsed);
	if (!resolved.ok) {
		return { ok: false, result: mapResolveToGenerateFailure(resolved) };
	}
	return { ok: true, resolved };
}

async function runModelOnce(
	systemPrompt: string,
	userPrompt: string,
	estimatedQuestionCount: number,
	outputSchema: ReturnType<typeof createPracticeGenerationOutputSchema>,
	opts: Pick<RunGenerationPipelineOptions, "useStreamObject" | "onPartialObject">,
): Promise<{ ok: true; object: PracticeGenerationGroupedOutput } | { ok: false; message: string }> {
	const maxOutputTokens = Math.min(32_000, Math.max(6_000, estimatedQuestionCount * 900));
	const model = getOpenAIProvider()(getOpenAIChatModel());
	const baseParams = {
		model,
		schema: outputSchema,
		system: systemPrompt,
		prompt: userPrompt,
		maxOutputTokens,
		maxRetries: 2,
		providerOptions: {
			openai: {
				strictJsonSchema: false,
			},
		},
	};

	if (opts.useStreamObject) {
		try {
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
			return { ok: true, object: object as PracticeGenerationGroupedOutput };
		} catch (e) {
			logServerError("runPracticeGeneration.streamObject", e);
			return {
				ok: false,
				message: `Could not generate the test. ${formatGenerationError(e)}`,
			};
		}
	}

	try {
		const { object } = await generateObject(baseParams);
		return { ok: true, object: object as PracticeGenerationGroupedOutput };
	} catch (e) {
		logServerError("generatePracticeTest.generateObject", e);
		return {
			ok: false,
			message: `Could not generate the test. ${formatGenerationError(e)}`,
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
	const plan = getPracticeQuestionPlan(durationSeconds);
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
		const r = await runModelOnce(systemPrompt, userPrompt, expectedCount, generationOutputSchema, opts);
		cumulativeModelMs += Date.now() - m0;
		if (!r.ok) return { ok: false, message: r.message, code: "generation_failed" };
		const v0 = Date.now();
		const flattened = flattenPracticeGenerationOutput(r.object);
		const out = validateAndStripGeneration(flattened, expectedCount, topicIdSet, {
			expectedDurationSeconds: durationSeconds,
			expectedTypeCounts,
		});
		cumulativeValidationMs += Date.now() - v0;
		if (!out.ok) {
			const actualTypeCounts = summarizeGroupedQuestionTypeCounts(r.object);
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

	const dedupThreshold = Number.parseInt(process.env.PRACTICE_DEDUP_MAX_REGENS ?? "1", 10);
	if (Number.isFinite(dedupThreshold) && dedupThreshold > 0) {
		const dedupT0 = Date.now();
		try {
			const texts = fullOutput.questions.map((q) => q.question_text);
			const embeddings = await embedQuestionTexts(texts);
			const dupes = await findDuplicatesAgainstStudent(
				supabase,
				resolved.userId,
				fullOutput.questions.map((q) => ({ topic_id: q.topic_id, question_text: q.question_text })),
				embeddings,
			);
			if (dupes.length > 0) {
				if (process.env.NODE_ENV === "development") {
					console.log(`[generatePracticeTest] dedup: ${dupes.length} duplicate(s), regenerating`);
				}
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
