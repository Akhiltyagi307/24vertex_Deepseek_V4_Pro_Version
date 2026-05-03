import type { z } from "zod";
import { generateText, NoObjectGeneratedError, Output } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";

export type CompleteChatJsonParams<TSchema extends z.ZodType> = {
	model: string;
	system: string;
	user: string;
	schema: TSchema;
	/** When set, logs a row in `ai_calls` for this completion. */
	telemetry?: { feature: string; userId?: string | null; promptId?: string | null };
};

export type CompleteChatJsonOk<T> = { ok: true; data: T };

export type CompleteChatJsonErr = {
	ok: false;
	code: "ai_provider_error" | "empty_response" | "invalid_json" | "schema_mismatch";
	message: string;
};

/**
 * Single structured chat completion via Vercel AI SDK (`generateText` + `Output.object`), then Zod validation.
 * Call only from server code (Route Handlers, Server Actions, Server Components).
 */
export async function completeChatJson<TSchema extends z.ZodType>(
	params: CompleteChatJsonParams<TSchema>,
): Promise<CompleteChatJsonOk<z.infer<TSchema>> | CompleteChatJsonErr> {
	const { model, system, user, schema, telemetry } = params;
	const t0 = Date.now();

	try {
		const result = await generateText({
			model: getOpenAIProvider().chat(model),
			system,
			prompt: user,
			output: Output.object({ schema }),
		});
		const { output } = result;
		const usage = result.usage;

		if (output == null) {
			if (telemetry) {
				void recordAiCall({
					feature: telemetry.feature,
					model,
					userId: telemetry.userId ?? null,
					promptId: telemetry.promptId ?? null,
					inputTokens: usage?.inputTokens ?? 0,
					outputTokens: usage?.outputTokens ?? 0,
					latencyMs: Date.now() - t0,
					status: "error",
					error: "empty structured output",
				});
			}
			return {
				ok: false,
				code: "empty_response",
				message: "The model returned no structured output.",
			};
		}

		if (telemetry) {
			void recordAiCall({
				feature: telemetry.feature,
				model,
				userId: telemetry.userId ?? null,
				promptId: telemetry.promptId ?? null,
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				latencyMs: Date.now() - t0,
				status: "ok",
			});
		}

		return { ok: true, data: output };
	} catch (e) {
		if (telemetry) {
			void recordAiCall({
				feature: telemetry.feature,
				model,
				userId: telemetry.userId ?? null,
				promptId: telemetry.promptId ?? null,
				inputTokens: 0,
				outputTokens: 0,
				latencyMs: Date.now() - t0,
				status: "error",
				error: e instanceof Error ? e.message : String(e),
			});
		}
		if (NoObjectGeneratedError.isInstance(e)) {
			const cause = e.cause;
			if (cause instanceof SyntaxError) {
				return {
					ok: false,
					code: "invalid_json",
					message: "The model returned invalid JSON.",
				};
			}
			return {
				ok: false,
				code: "schema_mismatch",
				message: "The model output did not match the expected shape.",
			};
		}

		const message = e instanceof Error ? e.message : "AI request failed";
		return { ok: false, code: "ai_provider_error", message };
	}
}
