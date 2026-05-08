/**
 * Tier 2 LLM eval runner for practice prompt fixtures.
 *
 * Sends each fixture's built system prompt + a minimal stringified user
 * message through the configured OpenAI chat model, parses the structured
 * output, and runs the fixture's output-assertion list.
 *
 * NOT runnable in CI by default — costs LLM calls. Invoke via:
 *
 *   tsx --env-file=.env.local src/lib/practice/__evals__/cli.ts
 *
 * or `pnpm run evals:practice`.
 */

import { generateText } from "ai";

import { getOpenAIProvider } from "../../ai/openai-provider";
import { getOpenAIApiKey, getOpenAIChatModel } from "../../env";
import { evaluateOutputAssertion } from "../__fixtures__/assertions";
import type {
	GeneratedOutput,
	OutputAssertionResult,
	PracticeFixture,
} from "../__fixtures__/types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type FixtureEvalResult = {
	fixtureId: string;
	subject: string;
	/** True iff every output assertion passed AND the model returned schema-valid JSON. */
	pass: boolean;
	/** True if the model returned schema-valid JSON (separate from assertion pass-rate). */
	schemaValid: boolean;
	/** Latency of the model call in milliseconds. */
	latencyMs: number;
	/** Token usage as reported by the SDK (best-effort). */
	usage: { inputTokens: number; outputTokens: number };
	/** Per-assertion results. Empty if schema validation failed (assertions never ran). */
	outputResults: OutputAssertionResult[];
	/** Error message if the call failed entirely. */
	error?: string;
};

export type EvalRunSummary = {
	totalFixtures: number;
	passed: number;
	failed: number;
	schemaInvalid: number;
	totalAssertions: number;
	passedAssertions: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalLatencyMs: number;
	results: FixtureEvalResult[];
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Build a stripped-down user message JSON from the fixture's userMessageSummary.
 * Topic_grounding is intentionally minimal — fixture evaluation tests structural
 * correctness, not style mirroring (which needs real chunks). For style-mirror
 * evaluation, supply real grounding via a future fixture extension.
 */
function buildSyntheticUserMessage(fixture: PracticeFixture): string {
	const allowedTopicIds =
		fixture.outputAssertions
			.filter((a) => a.type === "topicIdsFromList")
			.flatMap((a) => (a.type === "topicIdsFromList" ? a.allowedTopicIds : [])) ?? [];

	const topics = allowedTopicIds.map((id, idx) => ({
		topic_id: id,
		performance: {
			status: idx === 0 ? "weak" : "ok",
			average_score_percent: idx === 0 ? 50 : 75,
			tests_taken: 2,
			trend: "stable",
			last_test_date: null,
		},
	}));

	const topicGrounding = allowedTopicIds.map((id, idx) => ({
		topic_id: id,
		topic_name: `Topic ${idx + 1}`,
		curriculum_hint: {
			unit_name: "Unit 1",
			chapter_name: "Chapter 1",
			grade: fixture.input.generationSubject.subjectGrade ?? 10,
		},
		content_chunks: [],
		exercise_chunks: [],
	}));

	const userMessage = {
		schema_version: 3 as const,
		intent: "generate_practice_test" as const,
		student: {
			grade: fixture.input.generationSubject.studentGrade ?? null,
		},
		subject: {
			id: "fixture-subject",
			name: fixture.input.generationSubject.subjectName,
		},
		topic_grounding: topicGrounding,
		grounding_meta: {
			topic_count: topics.length,
			context_chunk_count: 0,
			exercise_chunk_count: 0,
			context_char_total: 0,
			exercise_char_total: 0,
			truncated: false,
			context_quality: "no_context" as const,
		},
		test_parameters: fixture.input.userMessageSummary.test_parameters,
		topics,
		constraints: fixture.input.userMessageSummary.constraints,
	};

	return `${JSON.stringify(userMessage, null, 2)}\n`;
}

/**
 * Extract a JSON object from the model's text output. The compact prompts ask
 * for "JSON only — no markdown fences, no commentary"; in practice we still
 * want to be tolerant of a leading/trailing fence or stray prose since this
 * is an eval (catching the violation is itself useful — it's an output-shape
 * issue, not an eval failure).
 */
function tryParseJsonOutput(raw: string): GeneratedOutput | null {
	const text = raw.trim();
	// Strip markdown fences if present
	const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
	const candidate = fenced ? fenced[1] : text;
	try {
		const parsed = JSON.parse(candidate);
		if (parsed && typeof parsed === "object") return parsed as GeneratedOutput;
		return null;
	} catch {
		// Try to find the first `{` and last `}` and parse the slice between them
		const first = candidate.indexOf("{");
		const last = candidate.lastIndexOf("}");
		if (first >= 0 && last > first) {
			try {
				const inner = candidate.slice(first, last + 1);
				const parsed = JSON.parse(inner);
				if (parsed && typeof parsed === "object") return parsed as GeneratedOutput;
			} catch {
				// fallthrough
			}
		}
		return null;
	}
}

/**
 * Run one fixture through the LLM and evaluate its output assertions.
 *
 * Uses free-form text generation + permissive client-side JSON parsing rather
 * than the production strict-schema mode. Reasons:
 *   1. The production schema (`createPracticeGenerationOutputSchema`) uses
 *      `optional()` fields (e.g., `options` on written-answer drafts) which
 *      OpenAI's strict-JSON-schema mode rejects.
 *   2. For evaluation we want to catch real failure modes including
 *      "model returned malformed JSON" — strict-schema mode would error
 *      before we could distinguish that from other failure modes.
 */
export async function runFixtureEval(
	fixture: PracticeFixture,
	systemPrompt: string,
	model: string,
): Promise<FixtureEvalResult> {
	const t0 = Date.now();
	const userMessage = buildSyntheticUserMessage(fixture);
	const expected = fixture.input.userMessageSummary.test_parameters;

	try {
		const result = await generateText({
			model: getOpenAIProvider().chat(model),
			system: systemPrompt,
			prompt: userMessage,
			// 12-question tests with rich explanations + Punnett tables can run long.
			// Production uses chunked generation; evals run single-shot so we need
			// generous budget per call. 16k covers all current fixtures comfortably.
			maxOutputTokens: 16000,
			// JSON-mode (no strict schema) — model produces valid JSON without us
			// enforcing the production schema's strict-mode quirks.
			providerOptions: {
				openai: {
					response_format: { type: "json_object" },
				},
			},
		});

		const latencyMs = Date.now() - t0;
		const usage = {
			inputTokens: result.usage?.inputTokens ?? 0,
			outputTokens: result.usage?.outputTokens ?? 0,
		};

		const output = tryParseJsonOutput(result.text ?? "");

		if (!output) {
			return {
				fixtureId: fixture.id,
				subject: fixture.subject,
				pass: false,
				schemaValid: false,
				latencyMs,
				usage,
				outputResults: [],
				error: `Model output is not parseable JSON. First 200 chars: ${(result.text ?? "").slice(0, 200)}`,
			};
		}

		// Run output assertions
		const ctx = {
			expectedTotalCount: expected.estimated_question_count,
			expectedPerBucket: expected.question_type_counts,
		};
		const outputResults = fixture.outputAssertions.map((a) =>
			evaluateOutputAssertion(output, a, ctx),
		);
		const allPass = outputResults.every((r) => r.pass);

		return {
			fixtureId: fixture.id,
			subject: fixture.subject,
			pass: allPass,
			schemaValid: true,
			latencyMs,
			usage,
			outputResults,
		};
	} catch (e) {
		const latencyMs = Date.now() - t0;
		const errMsg = e instanceof Error ? e.message : String(e);
		return {
			fixtureId: fixture.id,
			subject: fixture.subject,
			pass: false,
			schemaValid: false,
			latencyMs,
			usage: { inputTokens: 0, outputTokens: 0 },
			outputResults: [],
			error: errMsg,
		};
	}
}

/**
 * Run a list of fixtures sequentially through the LLM. Returns a summary.
 * Caller is responsible for ensuring `OPENAI_API_KEY` is set.
 */
export async function runEvalSet(
	fixtures: PracticeFixture[],
	options: {
		/** Override the model. Defaults to the configured chat model. */
		model?: string;
		/** Called after each fixture with its result — useful for live progress reporting. */
		onResult?: (r: FixtureEvalResult) => void;
		/** Called once after the model is resolved, before any fixture runs. */
		onModelResolved?: (model: string) => void;
		/** Build the system prompt for a fixture. Caller injects to avoid module cycle. */
		buildSystemPrompt: (fixture: PracticeFixture) => string;
	},
): Promise<EvalRunSummary> {
	if (!getOpenAIApiKey()) {
		throw new Error(
			"OPENAI_API_KEY is not set. Load .env.local before running the eval (e.g. `tsx --env-file=.env.local ...`).",
		);
	}

	const model = options.model ?? getOpenAIChatModel();
	options.onModelResolved?.(model);
	const results: FixtureEvalResult[] = [];

	for (const fixture of fixtures) {
		const systemPrompt = options.buildSystemPrompt(fixture);
		const result = await runFixtureEval(fixture, systemPrompt, model);
		results.push(result);
		options.onResult?.(result);
	}

	const totalAssertions = results.reduce(
		(acc, r) => acc + r.outputResults.length,
		0,
	);
	const passedAssertions = results.reduce(
		(acc, r) => acc + r.outputResults.filter((x) => x.pass).length,
		0,
	);

	return {
		totalFixtures: results.length,
		passed: results.filter((r) => r.pass).length,
		failed: results.filter((r) => !r.pass).length,
		schemaInvalid: results.filter((r) => !r.schemaValid).length,
		totalAssertions,
		passedAssertions,
		totalInputTokens: results.reduce((acc, r) => acc + r.usage.inputTokens, 0),
		totalOutputTokens: results.reduce((acc, r) => acc + r.usage.outputTokens, 0),
		totalLatencyMs: results.reduce((acc, r) => acc + r.latencyMs, 0),
		results,
	};
}
