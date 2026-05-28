import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ----------------------------------------------------------------------
// Mocks — defined BEFORE the SUT import. The driver pulls these as
// dependencies; we substitute stubs we can introspect.
// ----------------------------------------------------------------------

const generateStructuredMock = vi.fn();
const recordAiCallMock = vi.fn();
const logPracticeObsMock = vi.fn();
const logServerErrorMock = vi.fn();

vi.mock("@/lib/ai/structured-output", () => ({
	generateStructuredWithProviderFallback: (args: unknown) => generateStructuredMock(args),
}));

vi.mock("@/lib/ai/model-router", () => ({
	resolveChatModel: () => ({
		provider: "deepseek" as const,
		modelId: "deepseek-v4-flash-test",
		thinkingActive: false,
	}),
}));

vi.mock("@/lib/ai/openai-provider", () => ({
	getOpenAIProvider: () => ({ responses: () => ({}) }),
}));

vi.mock("@/lib/env", () => ({
	getOpenAIPracticeChatModel: () => "gpt-test",
}));

vi.mock("@/lib/ai/record-ai-call", () => ({
	recordAiCall: (args: unknown) => recordAiCallMock(args),
}));

vi.mock("@/lib/server/practice-observability", () => ({
	logPracticeObs: (args: unknown) => logPracticeObsMock(args),
}));

vi.mock("@/lib/server/log-supabase-error", () => ({
	logServerError: (...args: unknown[]) => logServerErrorMock(...args),
}));

// Stub topic-evidence selection — the driver only needs the function to
// return some array; the contents don't change test outcomes.
vi.mock("@/lib/practice/generation-evidence-pack", () => ({
	selectEvidenceForFailedIndexes: () => [],
}));

// Stub the env helpers we control independently.
const isEnabledMock = vi.fn(() => true);
const concurrencyMock = vi.fn(() => 8);
const modelOverrideMock = vi.fn(() => null);
vi.mock("../env", () => ({
	isPracticeVisualEnrichmentEnabled: () => isEnabledMock(),
	getPracticeVisualEnrichmentConcurrency: () => concurrencyMock(),
	getPracticeVisualEnrichmentModel: () => modelOverrideMock(),
}));

// Now we can import the SUT.
import { generateVisualEnrichmentPerQuestion } from "../generate-visual-enrichment-per-question";
import type { PracticeGenerationOutput } from "@/lib/practice/generation-schema";
import type { QuestionVisualKind } from "../types";

function makeOutput(questionCount = 5): PracticeGenerationOutput {
	return {
		questions: Array.from({ length: questionCount }, (_, i) => ({
			question_number: i + 1,
			topic_id: `topic-${i}`,
			question_text: `Question ${i + 1} text`,
			question_type: "multiple_choice",
			options: { A: "a", B: "b", C: "c", D: "d" },
			answer_key: { correct_answer: "A", explanation: "" },
			visual: null,
		})) as unknown as PracticeGenerationOutput["questions"],
	} as PracticeGenerationOutput;
}

const SAMPLE_ENVELOPE = {
	caption: "Coordinate plane with two labelled points.",
	altText: "A 2D coordinate plane showing point P at (1,2) and Q at (3,4).",
	spec: {
		kind: "math_geometry" as const,
		view: { xMin: -2, xMax: 5, yMin: -2, yMax: 5 },
		primitives: [
			{ type: "point" as const, at: { x: 1, y: 2 }, label: "P", labelPosition: "ne" as const },
			{ type: "point" as const, at: { x: 3, y: 4 }, label: "Q", labelPosition: "ne" as const },
		],
		showAxes: true,
		showGrid: true,
	},
};

function commonArgs(overrides?: Partial<Parameters<typeof generateVisualEnrichmentPerQuestion>[0]>) {
	const candidates = [0, 1, 2];
	return {
		output: makeOutput(5),
		userId: "user-1",
		subjectName: "Mathematics",
		preferredKinds: ["math_geometry"] as QuestionVisualKind[],
		evidenceByTopicId: new Map() as unknown as Parameters<
			typeof generateVisualEnrichmentPerQuestion
		>[0]["evidenceByTopicId"],
		topicExemplarHint: null,
		templatePolicy: null,
		candidateIndexes: candidates,
		candidateIntent: candidates.map((index) => ({
			index,
			priority: "high" as const,
			reason: "test",
			preferred_kind: "math_geometry" as QuestionVisualKind,
			blueprint_visual_idea: "Plot two labelled points.",
		})),
		strictGrounding: true,
		requireAtLeastOneVisual: false,
		generationRunId: "run-1",
		correlationId: "corr-1",
		...overrides,
	};
}

describe("generateVisualEnrichmentPerQuestion", () => {
	beforeEach(() => {
		generateStructuredMock.mockReset();
		recordAiCallMock.mockReset();
		logPracticeObsMock.mockReset();
		logServerErrorMock.mockReset();
		isEnabledMock.mockReturnValue(true);
		concurrencyMock.mockReturnValue(8);
		modelOverrideMock.mockReturnValue(null);
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns empty result when enrichment is disabled", async () => {
		isEnabledMock.mockReturnValueOnce(false);
		const result = await generateVisualEnrichmentPerQuestion(commonArgs());
		expect(result).toEqual({ ok: true, patches: [], modelMs: 0, inputTokens: 0, outputTokens: 0 });
		expect(generateStructuredMock).not.toHaveBeenCalled();
	});

	it("fans out K parallel calls and aggregates patches", async () => {
		generateStructuredMock.mockImplementation(async (_args: unknown) => {
			// Build a structured-output result for one call.
			return {
				object: { action: "replace_visual", index: 0, value: SAMPLE_ENVELOPE },
				usage: { inputTokens: 5_000, outputTokens: 300 },
				telemetry: {
					provider: "deepseek",
					modelId: "deepseek-v4-flash-test",
					reasoningTokens: 0,
					cacheHitTokens: 0,
					cacheMissTokens: 0,
				},
			};
		});

		const result = await generateVisualEnrichmentPerQuestion(commonArgs());

		expect(result.ok).toBe(true);
		expect(result.patches).toHaveLength(3);
		expect(result.perQuestionStats).toMatchObject({ k: 3, succeeded: 3, failed: 0 });
		expect(result.inputTokens).toBe(15_000);
		expect(result.outputTokens).toBe(900);
	});

	it("isolates per-call failure — others succeed", async () => {
		let callIdx = 0;
		generateStructuredMock.mockImplementation(async () => {
			const n = callIdx++;
			if (n === 1) throw new Error("zod-fail");
			return {
				object: { action: "replace_visual", index: n, value: SAMPLE_ENVELOPE },
				usage: { inputTokens: 5_000, outputTokens: 300 },
				telemetry: {
					provider: "deepseek",
					modelId: "deepseek-v4-flash-test",
					reasoningTokens: 0,
					cacheHitTokens: 0,
					cacheMissTokens: 0,
				},
			};
		});

		const result = await generateVisualEnrichmentPerQuestion(commonArgs());

		expect(result.ok).toBe(true);
		expect(result.patches).toHaveLength(2);
		expect(result.perQuestionStats).toMatchObject({ k: 3, succeeded: 2, failed: 1 });
	});

	it("returns ok:false when requireAtLeastOneVisual is set and all calls fail", async () => {
		generateStructuredMock.mockRejectedValue(new Error("always-fail"));

		const result = await generateVisualEnrichmentPerQuestion(
			commonArgs({ requireAtLeastOneVisual: true }),
		);

		expect(result.ok).toBe(false);
		expect(result.patches).toEqual([]);
		expect(result.perQuestionStats).toMatchObject({ succeeded: 0, failed: 3 });
	});

	it("passes per_question feature to the structured fallback wrapper", async () => {
		generateStructuredMock.mockResolvedValueOnce({
			object: { action: "null_visual", index: 0 },
			usage: { inputTokens: 100, outputTokens: 50 },
			telemetry: {
				provider: "deepseek",
				modelId: "deepseek-v4-flash-test",
				reasoningTokens: 0,
				cacheHitTokens: 0,
				cacheMissTokens: 0,
			},
		});

		await generateVisualEnrichmentPerQuestion(
			commonArgs({
				candidateIndexes: [0],
				candidateIntent: [
					{
						index: 0,
						priority: "high" as const,
						reason: "t",
						preferred_kind: "math_geometry" as QuestionVisualKind,
					},
				],
			}),
		);

		expect(generateStructuredMock).toHaveBeenCalledWith(
			expect.objectContaining({
				feature: "practice.generation.visual_enrichment.per_question",
			}),
		);
	});

	it("records fallback model in ai_calls when wrapper telemetry includes providerFallback", async () => {
		generateStructuredMock.mockResolvedValueOnce({
			object: { action: "null_visual", index: 0 },
			usage: { inputTokens: 100, outputTokens: 50 },
			telemetry: {
				provider: "openai",
				modelId: "gpt-5.4-mini",
				reasoningTokens: null,
				cacheHitTokens: null,
				cacheMissTokens: null,
				providerFallback: {
					primaryProvider: "deepseek",
					primaryModelId: "deepseek-v4-flash-test",
					fallbackModelId: "gpt-5.4-mini",
					reason: "429",
				},
			},
		});

		await generateVisualEnrichmentPerQuestion(
			commonArgs({
				candidateIndexes: [0],
				candidateIntent: [
					{
						index: 0,
						priority: "high" as const,
						reason: "t",
						preferred_kind: "math_geometry" as QuestionVisualKind,
					},
				],
			}),
		);

		expect(recordAiCallMock).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "gpt-5.4-mini",
				provider: "openai",
			}),
		);
	});

	it("emits one ai_calls row per candidate with the per_question feature name", async () => {
		generateStructuredMock.mockImplementation(async () => ({
			object: { action: "null_visual", index: 0 },
			usage: { inputTokens: 1_000, outputTokens: 50 },
			telemetry: {
				provider: "deepseek",
				modelId: "deepseek-v4-flash-test",
				reasoningTokens: 0,
				cacheHitTokens: 0,
				cacheMissTokens: 0,
			},
		}));

		await generateVisualEnrichmentPerQuestion(commonArgs());

		expect(recordAiCallMock).toHaveBeenCalledTimes(3);
		for (const call of recordAiCallMock.mock.calls) {
			expect(call[0]).toMatchObject({
				feature: "practice.generation.visual_enrichment.per_question",
				stepKey: "visual_enrichment_per_question",
			});
		}
	});

	it("respects PRACTICE_VISUAL_ENRICHMENT_CONCURRENCY cap", async () => {
		concurrencyMock.mockReturnValue(2);
		let inFlight = 0;
		let peakInFlight = 0;
		generateStructuredMock.mockImplementation(async () => {
			inFlight += 1;
			peakInFlight = Math.max(peakInFlight, inFlight);
			await new Promise((r) => setTimeout(r, 10));
			inFlight -= 1;
			return {
				object: { action: "null_visual", index: 0 },
				usage: { inputTokens: 1_000, outputTokens: 50 },
				telemetry: {
					provider: "deepseek",
					modelId: "deepseek-v4-flash-test",
					reasoningTokens: 0,
					cacheHitTokens: 0,
					cacheMissTokens: 0,
				},
			};
		});

		// 5 candidates to exercise the cap.
		const args = commonArgs({
			candidateIndexes: [0, 1, 2, 3, 4],
			candidateIntent: [0, 1, 2, 3, 4].map((index) => ({
				index,
				priority: "high" as const,
				reason: "t",
				preferred_kind: "math_geometry" as QuestionVisualKind,
			})),
		});
		await generateVisualEnrichmentPerQuestion(args);

		expect(peakInFlight).toBeLessThanOrEqual(2);
		expect(peakInFlight).toBeGreaterThanOrEqual(1);
	});

	it("forces the patch's index to the candidate index (defensive against LLM)", async () => {
		generateStructuredMock.mockImplementation(async () => ({
			// LLM hallucinates a different index — driver should overwrite it.
			object: { action: "replace_visual", index: 99, value: SAMPLE_ENVELOPE },
			usage: { inputTokens: 5_000, outputTokens: 300 },
			telemetry: {
				provider: "deepseek",
				modelId: "deepseek-v4-flash-test",
				reasoningTokens: 0,
				cacheHitTokens: 0,
				cacheMissTokens: 0,
			},
		}));

		const result = await generateVisualEnrichmentPerQuestion(
			commonArgs({
				candidateIndexes: [2],
				candidateIntent: [
					{
						index: 2,
						priority: "high" as const,
						reason: "t",
						preferred_kind: "math_geometry" as QuestionVisualKind,
					},
				],
			}),
		);
		expect(result.patches).toHaveLength(1);
		expect(result.patches[0]!.index).toBe(2);
	});
});
