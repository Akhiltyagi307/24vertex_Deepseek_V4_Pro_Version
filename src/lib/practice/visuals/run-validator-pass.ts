import "server-only";

import type { PracticeGenerationOutput } from "../generation-schema";
import { logServerError } from "@/lib/server/log-supabase-error";
import { getPracticeVisualValidatorModel, isPracticeVisualValidatorEnabled } from "./env";
import type { VisualPatch } from "./apply-visual-patches";

/**
 * Pass-2 visual validator. Runs after the deterministic autofix and
 * quality-gate pipeline (Pass 1) and BEFORE persistence. Behaviour:
 *
 *   • Disabled (PRACTICE_VISUAL_VALIDATOR != "true"): returns
 *     `{ ok: true, patches: [] }` immediately.
 *   • No question carries a visual: returns
 *     `{ ok: true, patches: [] }` (skips the model call).
 *   • Enabled with at least one visual: invokes the AI SDK with the
 *     shell tool + skills (skills.lock.json). The validator model
 *     is `PRACTICE_VISUAL_VALIDATOR_MODEL` when set, otherwise the
 *     same chat model Pass 1 uses.
 *   • Any error during the invocation is logged once via
 *     `logServerError` and returned as `{ ok: false, patches: [] }`
 *     so Pass 1's output ships unchanged. Per delivery plan §A4.
 *
 * IMPLEMENTATION STATUS: the OpenAI Responses-API + shell-tool +
 * skills integration is not yet wired into the Vercel AI SDK in
 * this repo's stack. Until it is, `runValidatorPass` returns no
 * patches even when the flag is on. Wiring goes inside the
 * `executeValidatorRun` helper at the bottom of this file; replace
 * the placeholder with the actual `generateText({ model, providerOptions:
 * { openai: { tools: [{ type: "shell", environment: { type:
 * "container_auto", skills: VALIDATOR_SKILL_REFS } }] } } })` call once
 * the API contract is verified.
 */

export type RunValidatorPassResult = { ok: boolean; patches: VisualPatch[] };

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
		// Single Sentry breadcrumb per process — Pass 1 still ships.
		logServerError("runValidatorPass.invoke", e, {
			correlationId: context.correlationId,
			userId: context.userId,
			model: getPracticeVisualValidatorModel() ?? "<default>",
		});
		return { ok: false, patches: [] };
	}
}

async function executeValidatorRun(
	_output: PracticeGenerationOutput,
	_context: { correlationId: string; userId: string },
): Promise<RunValidatorPassResult> {
	// Placeholder: the OpenAI Skills + shell-tool invocation goes here.
	// See v2 visuals guide §3.4 for the intended generateText() shape:
	//
	// const result = await generateText({
	//   model: getPracticeVisualValidatorModel()
	//     ? openai.responses(getPracticeVisualValidatorModel()!)
	//     : openai.responses(getOpenAIPracticeChatModel()),
	//   system:
	//     "You are a validator for an Indian secondary-school assessment. " +
	//     "For each question with a visual, run the appropriate skill. " +
	//     "Read the conventions skills before validators. Output a JSON " +
	//     "list of patches: [{ index, action: 'replace_visual'|'null_visual'" +
	//     "|'rewrite_stem'|'rewrite_explanation', value: ... }].",
	//   prompt: JSON.stringify({ test: _output }),
	//   providerOptions: {
	//     openai: {
	//       tools: [{
	//         type: "shell",
	//         environment: {
	//           type: "container_auto",
	//           skills: VALIDATOR_SKILL_REFS,
	//         },
	//       }],
	//     },
	//   },
	//   stopWhen: (s) => s.steps.length >= 8,
	// });
	// const patches = JSON.parse(result.text.trim()) as VisualPatch[];
	// return { ok: true, patches };
	//
	// Until the integration is verified live, we return no patches so
	// Pass 1's output ships unchanged. Flipping
	// PRACTICE_VISUAL_VALIDATOR=true is currently a no-op.
	return { ok: true, patches: [] };
}
