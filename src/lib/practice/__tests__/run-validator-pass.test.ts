import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PracticeGenerationOutput } from "../generation-schema";
import { executeValidatorRun } from "../visuals/run-validator-pass";

vi.mock("@/lib/ai/record-ai-call", () => ({
	recordAiCall: vi.fn(),
}));

vi.mock("@/lib/server/practice-observability", () => ({
	logPracticeObs: vi.fn(),
}));

const generateTextMock = vi.fn();

vi.mock("ai", async () => {
	const actual = await vi.importActual<typeof import("ai")>("ai");
	return {
		...actual,
		generateText: (...args: unknown[]) => generateTextMock(...args),
	};
});

vi.mock("@/lib/ai/openai-provider", () => {
	const shellTool = vi.fn(() => ({ __shell: true }));
	return {
		getOpenAIProvider: () => ({
			responses: vi.fn(() => ({ modelId: "responses-stub" })),
			tools: { shell: shellTool },
		}),
	};
});

vi.mock("../visuals/validator-skill-references", () => ({
	buildValidatorShellSkillReferences: vi.fn(() => []),
}));

describe("executeValidatorRun", () => {
	const ctx = { correlationId: "cid", userId: "user-1" };

	const minimalOutput: PracticeGenerationOutput = {
		generation_metadata: { adaptation_rationale: "t" },
		questions: [
			{
				question_number: 1,
				topic_id: "11111111-1111-4111-8111-111111111111",
				topic_name: "T",
				question_text: "Q",
				question_type: "multiple_choice",
				difficulty_level: "easy",
				options: { A: "a", B: "b", C: "c", D: "d" },
				answer_key: {
					correct_answer: "A",
					explanation: "e",
					common_mistakes: [],
					related_concept: "c",
				},
				estimated_time_seconds: 60,
				visual: {
					caption: "c",
					altText: "a",
					spec: { kind: "math_geometry", view: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, primitives: [] },
				},
			},
		],
	};

	beforeEach(() => {
		generateTextMock.mockReset();
		delete process.env.PRACTICE_VISUAL_VALIDATOR_USE_SHELL;
	});

	afterEach(() => {
		delete process.env.PRACTICE_VISUAL_VALIDATOR_USE_SHELL;
	});

	it("parses patches from model text", async () => {
		generateTextMock.mockResolvedValue({
			text: '[{"action":"null_visual","index":0}]',
			usage: { inputTokens: 1, outputTokens: 2 },
		});
		const r = await executeValidatorRun(minimalOutput, ctx);
		expect(r.ok).toBe(true);
		expect(r.patches).toEqual([{ action: "null_visual", index: 0 }]);
		expect(generateTextMock).toHaveBeenCalled();
		const call = generateTextMock.mock.calls[0]![0] as { tools?: unknown };
		expect(call.tools).toBeUndefined();
	});

	it("omits shell tool when PRACTICE_VISUAL_VALIDATOR_USE_SHELL=false", async () => {
		process.env.PRACTICE_VISUAL_VALIDATOR_USE_SHELL = "false";
		generateTextMock.mockResolvedValue({ text: "[]", usage: {} });
		await executeValidatorRun(minimalOutput, ctx);
		const call = generateTextMock.mock.calls[0]![0] as { tools?: unknown };
		expect(call.tools).toBeUndefined();
	});
});
