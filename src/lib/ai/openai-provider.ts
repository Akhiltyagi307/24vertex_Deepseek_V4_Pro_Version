import { createOpenAI } from "@ai-sdk/openai";

import { getOpenAIApiKey } from "@/lib/env";

let provider: ReturnType<typeof createOpenAI> | null = null;

/** OpenAI chat models via `@ai-sdk/openai` for use with the Vercel AI SDK. */
export function getOpenAIProvider() {
	if (!provider) {
		provider = createOpenAI({ apiKey: getOpenAIApiKey() });
	}
	return provider;
}
