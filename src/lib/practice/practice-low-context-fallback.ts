const LOW_CONTEXT_QUALITIES = new Set(["low_context", "no_context"]);

export function shouldUseLowContextFallback(args: {
	enabled: boolean;
	contextQuality?: string | null;
}): boolean {
	if (!args.enabled) return false;
	if (!args.contextQuality) return false;
	return LOW_CONTEXT_QUALITIES.has(args.contextQuality);
}

export function applyLowContextFallbackPromptGuards(prompts: {
	systemPrompt: string;
	userPrompt: string;
}): { systemPrompt: string; userPrompt: string } {
	const systemGuard = [
		"LOW_CONTEXT_FALLBACK_GUARD:",
		"- Treat retrieval context as sparse or degraded.",
		"- Prefer direct, textbook-safe, single-concept questions.",
		"- Do not rely on specific facts unless they are directly grounded.",
		"- If uncertain, choose generic concept checks over specific claims.",
	].join("\n");
	const userGuard = [
		"LOW_CONTEXT_MODE:",
		"- Context quality is degraded; keep prompts conservative and avoid unsupported detail.",
	].join("\n");
	return {
		systemPrompt: `${prompts.systemPrompt}\n\n${systemGuard}`,
		userPrompt: `${prompts.userPrompt}\n\n${userGuard}`,
	};
}
