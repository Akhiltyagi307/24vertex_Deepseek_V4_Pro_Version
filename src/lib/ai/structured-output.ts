import "server-only";

import {
	generateObject,
	generateText,
	streamObject,
	streamText,
	type LanguageModelUsage,
	type ProviderMetadata,
} from "ai";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
	extractDeepSeekCacheTokens,
	extractReasoningTokens,
	type ProviderOptions,
} from "./deepseek-provider";
import {
	buildProviderFallbackTelemetry,
	logProviderFallbackAttempt,
	resolveOpenAiFallbackResolved,
	shouldAttemptProviderFallback,
	type ProviderFallbackTelemetry,
} from "./provider-fallback";
import type { ResolvedAiModel } from "./model-router";

/**
 * Empty LanguageModelUsage object used when an exception path needs to
 * produce a usage record before the model ever returned one. Filling in
 * all required fields keeps the type system honest; values are `undefined`
 * because we genuinely don't know them.
 */
const EMPTY_USAGE: LanguageModelUsage = {
	inputTokens: undefined,
	outputTokens: undefined,
	totalTokens: undefined,
	inputTokenDetails: {
		noCacheTokens: undefined,
		cacheReadTokens: undefined,
		cacheWriteTokens: undefined,
	},
	outputTokenDetails: {
		textTokens: undefined,
		reasoningTokens: undefined,
	},
};

/**
 * Adapter that hides the OpenAI/DeepSeek bifurcation behind a generateObject /
 * streamObject shaped API.
 *
 * Why this exists: `@ai-sdk/deepseek` advertises ✗ for Object Generation in its
 * capability table — calling `generateObject({ model: deepseek(...) })` would
 * throw at runtime. DeepSeek does expose a free-form JSON mode
 * (`response_format: { type: 'json_object' }`) and reasoning content via the
 * thinking-mode providerOptions, but the call site needs to:
 *   (a) ask for JSON (the word "json" must appear in the prompt per DeepSeek docs),
 *   (b) parse the returned text manually, and
 *   (c) validate against the Zod schema, retrying on malformed output.
 *
 * This adapter centralises all of (a)/(b)/(c) so feature code keeps thinking in
 * terms of "give me an object matching this schema" — provider-agnostic.
 *
 * Telemetry (recordAiCall) is intentionally NOT done here: callers already
 * record their own rows with feature/generationRunId/stepKey context that the
 * adapter does not have. The adapter returns the new fields
 * (provider, reasoningTokens, cacheHit/MissTokens) so callers can persist them.
 */

export type StructuredCallTelemetry = {
	provider: "openai" | "deepseek";
	modelId: string;
	reasoningTokens: number | null;
	cacheHitTokens: number | null;
	cacheMissTokens: number | null;
	providerFallback?: ProviderFallbackTelemetry;
};

export type GenerateStructuredArgs<TSchema extends z.ZodType> = {
	/** Model handle from `resolveChatModel`. */
	resolved: ResolvedAiModel;
	/** Zod schema describing the expected object shape. */
	schema: TSchema;
	system: string;
	prompt: string;
	maxOutputTokens?: number;
	maxRetries?: number;
	abortSignal?: AbortSignal;
	/**
	 * Provider-specific extras (e.g. `{ openai: { strictJsonSchema: true } }`)
	 * merged INTO the providerOptions already set by the router (thinking
	 * mode for DeepSeek). Router options win — callers can't accidentally
	 * turn off thinking.
	 */
	providerOptions?: ProviderOptions;
	/** DeepSeek path only: number of repair turns on parse/schema failure. Default 2. */
	maxRepairAttempts?: number;
};

export type GenerateStructuredResult<T> = {
	object: T;
	usage: LanguageModelUsage;
	providerMetadata?: ProviderMetadata;
	telemetry: StructuredCallTelemetry;
};

function mergeProviderOptions(
	a: ProviderOptions,
	b: ProviderOptions | undefined,
): ProviderOptions {
	if (!b) return a;
	const merged: Record<string, Record<string, unknown>> = {
		...(b as Record<string, Record<string, unknown>>),
	};
	for (const [key, val] of Object.entries(a as Record<string, Record<string, unknown>>)) {
		merged[key] = { ...(merged[key] ?? {}), ...val };
	}
	return merged as ProviderOptions;
}

function buildJsonModePreamble<TSchema extends z.ZodType>(schema: TSchema): string {
	// `target: "openApi3"` produces an open-schema variant that doesn't include
	// `$ref` indirection — easier for the model to follow and avoids the rare
	// case where DeepSeek's JSON mode emits the schema definition instead of
	// the data.
	const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });
	return [
		"You MUST return only a single valid JSON object that conforms to the schema below.",
		'Do not include prose, markdown fences, or commentary. The word "json" appears here intentionally to satisfy the API\'s json output mode.',
		"",
		"OUTPUT_JSON_SCHEMA:",
		JSON.stringify(jsonSchema),
	].join("\n");
}

/**
 * For DeepSeek we deliberately do NOT pass `maxOutputTokens` to the SDK —
 * the empirically-tuned 3x multiplier was a band-aid for the earlier "CoT
 * eats the whole 8K budget and final text is empty" failure mode. The
 * cleaner fix is to let DeepSeek use its server-side default (32K with
 * thinking enabled on V4 Pro, ceiling 64K), so we never artificially
 * truncate a model that's mid-reasoning.
 *
 * Caller-passed `maxOutputTokens` is honoured for OpenAI calls (where the
 * Vercel SDK uses it directly) but dropped for DeepSeek.
 */
function deepseekAdjustedMaxOutputTokens(
	_callerMax: number | undefined,
	_thinkingActive: boolean,
): number | undefined {
	return undefined;
}

function extractJsonObject(text: string): string | null {
	// DeepSeek's JSON mode usually returns pure JSON, but defensively strip
	// markdown fences and locate the first balanced brace-pair if needed.
	const trimmed = text.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

	// Strip ```json ... ``` fences.
	const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
	if (fence?.[1]) {
		const inner = fence[1].trim();
		if (inner.startsWith("{") && inner.endsWith("}")) return inner;
	}

	// Last resort: first {…} block. Naive brace match; fine for the kinds of
	// payloads we produce (no embedded RAW braces in strings outside JSON).
	const first = trimmed.indexOf("{");
	const last = trimmed.lastIndexOf("}");
	if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
	return null;
}

function parseAndValidate<TSchema extends z.ZodType>(
	text: string,
	schema: TSchema,
):
	| { ok: true; data: z.infer<TSchema> }
	| { ok: false; reason: "empty" | "invalid_json" | "schema_mismatch"; detail: string } {
	const slice = extractJsonObject(text);
	if (!slice) return { ok: false, reason: "empty", detail: "Empty or unparseable response." };
	let parsed: unknown;
	try {
		parsed = JSON.parse(slice);
	} catch (e) {
		return {
			ok: false,
			reason: "invalid_json",
			detail: e instanceof Error ? e.message : "JSON parse failed.",
		};
	}
	const safe = schema.safeParse(parsed);
	if (!safe.success) {
		return {
			ok: false,
			reason: "schema_mismatch",
			detail: safe.error.issues
				.slice(0, 6)
				.map((i) => `${i.path.join(".")}: ${i.message}`)
				.join("; "),
		};
	}
	return { ok: true, data: safe.data };
}

function buildRepairPrompt(originalText: string, failure: { reason: string; detail: string }): string {
	return [
		"Your previous response could not be used. Return ONLY a corrected JSON object — same schema, no prose, no markdown fences.",
		`FAILURE_REASON: ${failure.reason}`,
		`FAILURE_DETAIL: ${failure.detail}`,
		"",
		"PREVIOUS_RESPONSE:",
		originalText,
	].join("\n");
}

/**
 * One-shot structured generation. Routes to native `generateObject` for OpenAI,
 * or JSON-mode + Zod-validate + repair-loop for DeepSeek.
 */
export async function generateStructured<TSchema extends z.ZodType>(
	args: GenerateStructuredArgs<TSchema>,
): Promise<GenerateStructuredResult<z.infer<TSchema>>> {
	const { resolved, schema, system, prompt, maxOutputTokens, maxRetries, abortSignal } = args;
	const mergedProviderOptions = mergeProviderOptions(
		resolved.providerOptions,
		args.providerOptions,
	);

	if (resolved.supportsNativeObjectGeneration) {
		const result = await generateObject({
			model: resolved.model,
			schema,
			system,
			prompt,
			maxOutputTokens,
			maxRetries,
			abortSignal,
			providerOptions: mergedProviderOptions,
		});
		return {
			object: result.object as z.infer<TSchema>,
			usage: result.usage,
			providerMetadata: result.providerMetadata,
			telemetry: {
				provider: resolved.provider,
				modelId: resolved.modelId,
				reasoningTokens: extractReasoningTokens(
					result.usage as { reasoningTokens?: number | null } | undefined,
				),
				cacheHitTokens: null,
				cacheMissTokens: null,
			},
		};
	}

	// DeepSeek path: free-form JSON mode → manual parse → schema → repair.
	const jsonModePreamble = buildJsonModePreamble(schema);
	const systemWithPreamble = `${system}\n\n${jsonModePreamble}`;
	const maxRepairAttempts = args.maxRepairAttempts ?? 2;
	const adjustedMaxOutputTokens = deepseekAdjustedMaxOutputTokens(
		maxOutputTokens,
		resolved.thinkingActive,
	);

	let lastResultText = "";
	let lastUsage: LanguageModelUsage = EMPTY_USAGE;
	let lastProviderMetadata: ProviderMetadata | undefined;
	let lastFailure: { reason: string; detail: string } | null = null;

	const attempts = maxRepairAttempts + 1;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const currentPrompt =
			attempt === 0
				? prompt
				: `${prompt}\n\n${buildRepairPrompt(lastResultText, lastFailure!)}`;

		const result = await generateText({
			model: resolved.model,
			system: systemWithPreamble,
			prompt: currentPrompt,
			maxOutputTokens: adjustedMaxOutputTokens,
			maxRetries,
			abortSignal,
			providerOptions: mergedProviderOptions,
		});

		lastResultText = result.text ?? "";
		lastUsage = result.usage;
		lastProviderMetadata = result.providerMetadata;

		const validated = parseAndValidate(lastResultText, schema);
		if (validated.ok) {
			const cacheBreakdown = extractDeepSeekCacheTokens(
				lastProviderMetadata as Record<string, unknown> | undefined,
			);
			return {
				object: validated.data,
				usage: lastUsage,
				providerMetadata: lastProviderMetadata,
				telemetry: {
					provider: resolved.provider,
					modelId: resolved.modelId,
					reasoningTokens: extractReasoningTokens(
						lastUsage as { reasoningTokens?: number | null },
					),
					cacheHitTokens: cacheBreakdown.cacheHitTokens,
					cacheMissTokens: cacheBreakdown.cacheMissTokens,
				},
			};
		}
		lastFailure = validated;
	}

	// Exhausted attempts — throw to match `generateObject` semantics so the
	// outer error handler (logServerError + recordAiCall status=error) fires.
	const err = new Error(
		`DeepSeek structured generation failed after ${attempts} attempts: ${lastFailure?.reason ?? "unknown"} — ${
			lastFailure?.detail ?? "no detail"
		}`,
	);
	(err as { code?: string }).code = "deepseek_structured_failure";
	throw err;
}

/** Test-only override for {@link generateStructuredWithProviderFallback}. */
let generateStructuredDelegate: typeof generateStructured | undefined;

function invokeGenerateStructured<TSchema extends z.ZodType>(
	args: GenerateStructuredArgs<TSchema>,
): Promise<GenerateStructuredResult<z.infer<TSchema>>> {
	const impl = generateStructuredDelegate ?? generateStructured;
	return impl(args);
}

export type GenerateStructuredWithFallbackArgs<TSchema extends z.ZodType> =
	GenerateStructuredArgs<TSchema> & {
		/** Used in fallback logs (e.g. `practice.generation.blueprint`). */
		feature?: string;
	};

/**
 * Like {@link generateStructured} but retries once on OpenAI when the primary
 * DeepSeek call fails with a retryable provider error (429 / overload / etc.).
 */
export async function generateStructuredWithProviderFallback<TSchema extends z.ZodType>(
	args: GenerateStructuredWithFallbackArgs<TSchema>,
): Promise<GenerateStructuredResult<z.infer<TSchema>>> {
	const primaryResolved = args.resolved;
	try {
		return await invokeGenerateStructured(args);
	} catch (primaryError) {
		if (
			!shouldAttemptProviderFallback({
				primary: primaryResolved,
				error: primaryError,
				feature: args.feature,
			})
		) {
			throw primaryError;
		}
		const fallbackResolved = resolveOpenAiFallbackResolved();
		if (!fallbackResolved) throw primaryError;
		logProviderFallbackAttempt({
			feature: args.feature ?? "structured_output",
			primaryModelId: primaryResolved.modelId,
			fallbackModelId: fallbackResolved.modelId,
			error: primaryError,
		});
		const result = await invokeGenerateStructured({ ...args, resolved: fallbackResolved });
		return {
			...result,
			telemetry: {
				...result.telemetry,
				providerFallback: buildProviderFallbackTelemetry(
					primaryResolved,
					fallbackResolved.modelId,
					primaryError,
				),
			},
		};
	}
}

/**
 * Streaming structured generation.
 *
 * - OpenAI: delegates to native `streamObject`, preserving `partialObjectStream`.
 * - DeepSeek: buffers `streamText`, then parses + validates the final text.
 *   The returned `partialObjectStream` emits exactly once at the end (the full
 *   object) so consumers can still `for await (const partial of stream)` —
 *   they just won't see progressive deltas while reasoning happens. This is a
 *   conscious UX trade-off for thinking-mode quality; tracked in
 *   docs/deepseek-migration-plan.md §3.3 (TODO: add streaming-JSON parser).
 *
 * Return shape mirrors `streamObject` closely enough that callers only need to
 * change the import.
 */
export type StreamStructuredResult<T> = {
	partialObjectStream: AsyncIterable<Partial<T>>;
	object: Promise<T>;
	usage: Promise<LanguageModelUsage>;
	providerMetadata: Promise<ProviderMetadata | undefined>;
	telemetry: Promise<StructuredCallTelemetry>;
};

export function streamStructured<TSchema extends z.ZodType>(
	args: GenerateStructuredArgs<TSchema>,
): StreamStructuredResult<z.infer<TSchema>> {
	const { resolved, schema, system, prompt, maxOutputTokens, maxRetries, abortSignal } = args;
	const mergedProviderOptions = mergeProviderOptions(
		resolved.providerOptions,
		args.providerOptions,
	);

	if (resolved.supportsNativeObjectGeneration) {
		const stream = streamObject({
			model: resolved.model,
			schema,
			system,
			prompt,
			maxOutputTokens,
			maxRetries,
			abortSignal,
			providerOptions: mergedProviderOptions,
		});
		return {
			partialObjectStream: stream.partialObjectStream as AsyncIterable<Partial<z.infer<TSchema>>>,
			object: stream.object as Promise<z.infer<TSchema>>,
			usage: stream.usage,
			providerMetadata: stream.providerMetadata,
			telemetry: (async () => {
				const usage = await stream.usage;
				return {
					provider: resolved.provider,
					modelId: resolved.modelId,
					reasoningTokens: extractReasoningTokens(
						usage as { reasoningTokens?: number | null },
					),
					cacheHitTokens: null,
					cacheMissTokens: null,
				};
			})(),
		};
	}

	// DeepSeek streaming: run streamText, accumulate, parse at end.
	const jsonModePreamble = buildJsonModePreamble(schema);
	const systemWithPreamble = `${system}\n\n${jsonModePreamble}`;
	const adjustedMaxOutputTokens = deepseekAdjustedMaxOutputTokens(
		maxOutputTokens,
		resolved.thinkingActive,
	);

	// We need to share the final parsed object across partialObjectStream and
	// the `object` promise. A single deferred promise + an async iterable that
	// awaits it gives us that without re-invoking the model.
	let objectResolve!: (v: z.infer<TSchema>) => void;
	let objectReject!: (e: unknown) => void;
	const objectPromise = new Promise<z.infer<TSchema>>((res, rej) => {
		objectResolve = res;
		objectReject = rej;
	});
	let usageResolve!: (v: LanguageModelUsage) => void;
	const usagePromise = new Promise<LanguageModelUsage>((res) => {
		usageResolve = res;
	});
	let providerMetadataResolve!: (v: ProviderMetadata | undefined) => void;
	const providerMetadataPromise = new Promise<ProviderMetadata | undefined>((res) => {
		providerMetadataResolve = res;
	});
	let telemetryResolve!: (v: StructuredCallTelemetry) => void;
	const telemetryPromise = new Promise<StructuredCallTelemetry>((res) => {
		telemetryResolve = res;
	});

	(async () => {
		try {
			const result = streamText({
				model: resolved.model,
				system: systemWithPreamble,
				prompt,
				maxOutputTokens: adjustedMaxOutputTokens,
				maxRetries,
				abortSignal,
				providerOptions: mergedProviderOptions,
			});
			// Drain the text stream into a buffer. `result.text` is also a
			// promise that resolves to the full text but iterating gives us the
			// chance to bail early if abortSignal fires mid-stream.
			let buf = "";
			for await (const chunk of result.textStream) buf += chunk;
			const usage = await result.usage;
			const providerMetadata = await result.providerMetadata;
			usageResolve(usage);
			providerMetadataResolve(providerMetadata);

			const validated = parseAndValidate(buf, schema);
			if (!validated.ok) {
				const err = new Error(
					`DeepSeek streamed structured generation failed: ${validated.reason} — ${validated.detail}`,
				);
				(err as { code?: string }).code = "deepseek_structured_failure";
				objectReject(err);
				telemetryResolve({
					provider: resolved.provider,
					modelId: resolved.modelId,
					reasoningTokens: extractReasoningTokens(
						usage as { reasoningTokens?: number | null },
					),
					...extractDeepSeekCacheTokens(
						providerMetadata as Record<string, unknown> | undefined,
					),
				});
				return;
			}
			objectResolve(validated.data);
			telemetryResolve({
				provider: resolved.provider,
				modelId: resolved.modelId,
				reasoningTokens: extractReasoningTokens(
					usage as { reasoningTokens?: number | null },
				),
				...extractDeepSeekCacheTokens(
					providerMetadata as Record<string, unknown> | undefined,
				),
			});
		} catch (e) {
			objectReject(e);
			usageResolve(EMPTY_USAGE);
			providerMetadataResolve(undefined);
			telemetryResolve({
				provider: resolved.provider,
				modelId: resolved.modelId,
				reasoningTokens: null,
				cacheHitTokens: null,
				cacheMissTokens: null,
			});
		}
	})();

	const partialObjectStream: AsyncIterable<Partial<z.infer<TSchema>>> = {
		[Symbol.asyncIterator]() {
			let done = false;
			return {
				async next(): Promise<IteratorResult<Partial<z.infer<TSchema>>>> {
					if (done) return { value: undefined, done: true };
					done = true;
					try {
						const value = await objectPromise;
						return { value, done: false };
					} catch {
						// On failure, terminate the stream with no emissions —
						// the `object` promise still rejects with the real
						// error, which the caller awaits.
						return { value: undefined, done: true };
					}
				},
			};
		},
	};

	return {
		partialObjectStream,
		object: objectPromise,
		usage: usagePromise,
		providerMetadata: providerMetadataPromise,
		telemetry: telemetryPromise,
	};
}

/**
 * Like {@link streamStructured} but retries once on OpenAI when the primary
 * DeepSeek stream fails with a retryable provider error.
 */
export function streamStructuredWithProviderFallback<TSchema extends z.ZodType>(
	args: GenerateStructuredWithFallbackArgs<TSchema>,
): StreamStructuredResult<z.infer<TSchema>> {
	const primaryResolved = args.resolved;
	const primary = streamStructured(args);
	// `let` with initial `null` gets narrowed to `null` by TS in nested
	// closures because the assignment in the `.catch` below is cross-closure
	// and not seen by control-flow analysis. The `as` here widens back to the
	// declared union so the IIFEs reading `fallbackStream` after a runtime
	// null-check don't collapse to `never`.
	let fallbackStream = null as StreamStructuredResult<z.infer<TSchema>> | null;
	let fallbackTelemetry: ProviderFallbackTelemetry | undefined;

	const object = primary.object.catch(async (primaryError: unknown) => {
		if (
			!shouldAttemptProviderFallback({
				primary: primaryResolved,
				error: primaryError,
				feature: args.feature,
			})
		) {
			throw primaryError;
		}
		const fallbackResolved = resolveOpenAiFallbackResolved();
		if (!fallbackResolved) throw primaryError;
		logProviderFallbackAttempt({
			feature: args.feature ?? "structured_output_stream",
			primaryModelId: primaryResolved.modelId,
			fallbackModelId: fallbackResolved.modelId,
			error: primaryError,
		});
		fallbackTelemetry = buildProviderFallbackTelemetry(
			primaryResolved,
			fallbackResolved.modelId,
			primaryError,
		);
		fallbackStream = streamStructured({ ...args, resolved: fallbackResolved });
		return fallbackStream.object;
	});

	const partialObjectStream: AsyncIterable<Partial<z.infer<TSchema>>> = {
		[Symbol.asyncIterator]() {
			let done = false;
			return {
				async next(): Promise<IteratorResult<Partial<z.infer<TSchema>>>> {
					if (done) return { value: undefined, done: true };
					done = true;
					try {
						const value = await object;
						return { value, done: false };
					} catch {
						return { value: undefined, done: true };
					}
				},
			};
		},
	};

	return {
		partialObjectStream,
		object,
		// Capture `fallbackStream` into locals inside each async closure so TS
		// doesn't narrow the outer `let`-declared variable to `never`. The
		// outer var is mutated only inside the `object` `.catch` closure and
		// the type checker can't track cross-closure assignments — `fb` here
		// is just a read snapshot at the time the catch runs.
		usage: (async () => {
			try {
				await primary.object;
				return primary.usage;
			} catch (primaryError) {
				const fb = fallbackStream;
				if (!fb) throw primaryError;
				await fb.object;
				return fb.usage;
			}
		})(),
		providerMetadata: (async () => {
			try {
				await primary.object;
				return primary.providerMetadata;
			} catch (primaryError) {
				const fb = fallbackStream;
				if (!fb) throw primaryError;
				await fb.object;
				return fb.providerMetadata;
			}
		})(),
		telemetry: (async () => {
			try {
				await primary.object;
				return primary.telemetry;
			} catch (primaryError) {
				const fb = fallbackStream;
				if (!fb) throw primaryError;
				const telemetry = await fb.telemetry;
				return {
					...telemetry,
					providerFallback: fallbackTelemetry,
				};
			}
		})(),
	};
}

/** Metadata fragment for `practice_generation_steps.metadata` when fallback ran. */
export function providerFallbackStepMetadata(
	telemetry: StructuredCallTelemetry,
): Record<string, string | boolean> | null {
	if (!telemetry.providerFallback) return null;
	return {
		provider_fallback: true,
		primary_model: telemetry.providerFallback.primaryModelId,
		fallback_model: telemetry.providerFallback.fallbackModelId,
		fallback_reason: telemetry.providerFallback.reason,
	};
}

/**
 * Test-only handles for the internal parsing helpers. Not part of the public
 * API; subject to change without notice.
 */
export const __testOnly = {
	extractJsonObject,
	parseAndValidate,
	buildJsonModePreamble,
	buildRepairPrompt,
	mergeProviderOptions,
	setGenerateStructuredDelegate: (fn: typeof generateStructured | undefined) => {
		generateStructuredDelegate = fn;
	},
};
