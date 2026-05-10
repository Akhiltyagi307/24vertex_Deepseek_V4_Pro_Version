import "server-only";

import { generateText, stepCountIs } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { getOpenAIPracticeChatModel } from "@/lib/env";
import { logPracticeObs } from "@/lib/server/practice-observability";
import { logServerError } from "@/lib/server/log-supabase-error";
import type { PracticeGenerationOutput } from "../generation-schema";
import type { VisualPatch } from "./apply-visual-patches";
import { getPracticeVisualValidatorModel, isPracticeVisualValidatorEnabled } from "./env";
import { parseVisualPatchesFromValidatorText } from "./parse-validator-patches";
import { buildValidatorShellSkillReferences } from "./validator-skill-references";

const VALIDATOR_SYSTEM = `You are a validator for Indian secondary-school (NCERT-aligned) practice tests.

For each question that has a non-null \`visual\`, use the mounted skills (conventions + validators) via the shell tool when available.
Read conventions skills before running validators.

Your final answer MUST be ONLY a JSON array (no markdown prose) of patch objects, each with:
- index: 0-based question index in the input test.questions array
- action: one of "replace_visual" | "null_visual" | "rewrite_stem" | "rewrite_explanation"
- For replace_visual: include "value" as the full visual envelope object (caption, altText, spec).
- For null_visual: no extra fields.
- For rewrite_stem: include "question_text".
- For rewrite_explanation: include "explanation" (answer_key.explanation only).

If no changes are needed, output an empty JSON array: [].

Do not include markdown code fences. Output raw JSON only.`;

export type RunValidatorPassResult = { ok: boolean; patches: VisualPatch[] };

function isValidatorShellDisabled(): boolean {
	return process.env.PRACTICE_VISUAL_VALIDATOR_USE_SHELL === "false";
}

export async function runValidatorPass(
	output: PracticeGenerationOutput,
	context: { correlationId: string; userId: string },
): Promise<RunValidatorPassResult> {
	if (!isPracticeVisualValidatorEnabled()) {
		return { ok: true, patches: [] };
	}
	const hasVisual = output.questions.some((q) => q.visual != null);
	if (!hasVisual) {
		return { ok: true, patches: [] };
	}
	try {
		return await executeValidatorRun(output, context);
	} catch (e) {
		logServerError("runValidatorPass.invoke", e, {
			correlationId: context.correlationId,
			userId: context.userId,
			model: getPracticeVisualValidatorModel() ?? "<default>",
		});
		return { ok: false, patches: [] };
	}
}

type ExecuteMeta = { correlationId: string; userId: string };

export async function executeValidatorRun(
	output: PracticeGenerationOutput,
	context: ExecuteMeta,
): Promise<RunValidatorPassResult> {
	const modelId = getPracticeVisualValidatorModel() ?? getOpenAIPracticeChatModel();
	const provider = getOpenAIProvider();
	const skillRefs = buildValidatorShellSkillReferences();
	const useShell = !isValidatorShellDisabled() && skillRefs.length > 0;

	const tools = useShell ?
		{
			shell: provider.tools.shell({
				environment: {
					type: "containerAuto",
					skills: skillRefs,
				},
			}),
		}
	:	undefined;

	const t0 = Date.now();
	try {
		const result = await generateText({
			model: provider.responses(modelId),
			system: VALIDATOR_SYSTEM,
			prompt: JSON.stringify({ test: output }),
			tools,
			toolChoice: tools ? "auto" : undefined,
			stopWhen: tools ? stepCountIs(8) : stepCountIs(1),
			maxOutputTokens: 8192,
			maxRetries: 0,
		});

		const patches = parseVisualPatchesFromValidatorText(result.text);
		const usage = result.usage;

		void recordAiCall({
			feature: "practice.generation.validator_pass",
			model: modelId,
			userId: context.userId,
			promptId: null,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			latencyMs: Date.now() - t0,
			status: "ok",
		});

		logPracticeObs({
			phase: "practice_generation_validator_pass",
			correlation_id: context.correlationId,
			mode: useShell ? "shell_skills" : "text_only",
			skill_ref_count: skillRefs.length,
			patch_candidates: patches.length,
			parse_empty: patches.length === 0 && result.text.trim().length > 0,
		});

		return { ok: true, patches };
	} catch (e) {
		void recordAiCall({
			feature: "practice.generation.validator_pass",
			model: modelId,
			userId: context.userId,
			promptId: null,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: Date.now() - t0,
			status: "error",
			error: e instanceof Error ? e.message : String(e),
		});
		throw e;
	}
}
