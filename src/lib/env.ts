function readTrimmedEnv(name: string): string {
	return process.env[name]?.trim() ?? "";
}

function parseHttpUrl(raw: string, envName: string): string {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		throw new Error(`Invalid ${envName}: expected an absolute URL.`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`Invalid ${envName}: expected http:// or https://.`);
	}
	const href = parsed.toString();
	return href.endsWith("/") ? href.slice(0, -1) : href;
}

function isLoopbackHost(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isProductionDeployment(): boolean {
	return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function getSupabaseUrl(): string {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
	return url;
}

/** Private bucket for GDPR/DSR ZIP exports (create in Supabase Dashboard; default name). */
export function getComplianceExportsBucket(): string {
	return readTrimmedEnv("COMPLIANCE_EXPORTS_BUCKET") || "compliance-exports";
}

/** Publishable (recommended) or legacy anon JWT */
export function getSupabasePublishableKey(): string {
	const key =
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!key) {
		throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
	}
	return key;
}

export function getAppUrl(): string {
	const configured = readTrimmedEnv("NEXT_PUBLIC_APP_URL");
	if (!configured) {
		if (isProductionDeployment()) {
			throw new Error("Missing NEXT_PUBLIC_APP_URL");
		}
		// Align with `scripts/next-dev.mjs` (`next dev -H 127.0.0.1`): the dev server
		// listens on IPv4 loopback. Using `localhost` here splits auth cookies from
		// browsers that open `http://127.0.0.1:PORT` (different host-only cookie jars).
		const port = readTrimmedEnv("PORT") || "3001";
		return `http://127.0.0.1:${port}`;
	}
	const appUrl = parseHttpUrl(configured, "NEXT_PUBLIC_APP_URL");
	if (isProductionDeployment() && isLoopbackHost(new URL(appUrl).hostname)) {
		throw new Error("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
	}
	return appUrl;
}

/**
 * Optional support inbox shown on legal pages. If unset, copy falls back to in-app / school routing.
 * Must be safe to expose to the browser (NEXT_PUBLIC_).
 */
export function getPublicSupportEmail(): string | null {
	const raw = readTrimmedEnv("NEXT_PUBLIC_SUPPORT_EMAIL");
	if (!raw || !raw.includes("@")) return null;
	return raw;
}

/**
 * Inbox that actually receives contact-form submissions. Server-only.
 *
 * Lets the public-facing support email (shown in marketing UI, legal pages,
 * the contact-form timeline aside) differ from the inbox where notifications
 * are delivered. Falls back to {@link getPublicSupportEmail} when unset so
 * existing deployments keep working without any config change.
 */
export function getContactNotificationEmail(): string | null {
	const raw = readTrimmedEnv("CONTACT_NOTIFICATION_EMAIL");
	if (raw && raw.includes("@")) return raw;
	return getPublicSupportEmail();
}

/** Resend API key — required when sending parent contact notifications. */
export function getResendApiKey(): string {
	const key = process.env.RESEND_API_KEY?.trim();
	if (!key) throw new Error("Missing RESEND_API_KEY");
	return key;
}

/**
 * Verified sender for Resend, e.g. `24Vertex <notifications@yourdomain.com>` or `notifications@yourdomain.com`.
 * Prefer `RESEND_FROM_EMAIL`; `RESEND_FROM` is supported for backward compatibility.
 */
export function getResendFrom(): string {
	const from =
		process.env.RESEND_FROM_EMAIL?.trim() || process.env.RESEND_FROM?.trim();
	if (!from) {
		throw new Error("Missing RESEND_FROM_EMAIL or RESEND_FROM");
	}
	return from;
}

/**
 * Server-only secret used to sign one-click unsubscribe tokens that go in the
 * `List-Unsubscribe` email header. Returns `null` when the env var is unset —
 * the email pipeline gracefully skips the header instead of throwing, so a
 * missing secret degrades to "no one-click" rather than blocking sends.
 */
export function getEmailUnsubscribeSecret(): string | null {
	const raw = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
	return raw && raw.length >= 32 ? raw : null;
}

/**
 * Recipients for admin-side notification mail (panic, weekly digest). Reads
 * `ADMIN_NOTIFICATION_EMAILS` first as a comma-separated distribution list,
 * then falls back to `ADMIN_EMAIL` for single-admin deployments. Whitespace
 * around each entry is trimmed and empties are dropped. Returns `[]` when
 * nothing is configured — callers should treat that as "no admin to email".
 *
 * Note: admin-login auth still gates on the single `ADMIN_EMAIL` variable
 * (see `src/lib/admin/auth.ts`); this helper is only for outbound
 * notifications and intentionally does not change auth behaviour.
 */
export function getAdminNotificationRecipients(): string[] {
	const list = process.env.ADMIN_NOTIFICATION_EMAILS?.trim();
	if (list) {
		return list
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s.includes("@"));
	}
	const single = process.env.ADMIN_EMAIL?.trim();
	if (single && single.includes("@")) return [single];
	return [];
}

/** OpenAI API key — server-only; used by `@ai-sdk/openai` with the Vercel AI SDK. */
export function getOpenAIApiKey(): string {
	const key = process.env.OPENAI_API_KEY?.trim();
	if (!key) throw new Error("Missing OPENAI_API_KEY");
	return key;
}

/** Chat model id for `@ai-sdk/openai`. Override with `OPENAI_CHAT_MODEL`. */
export function getOpenAIChatModel(): string {
	const model = readTrimmedEnv("OPENAI_CHAT_MODEL");
	if (model) return model;
	if (isProductionDeployment()) {
		throw new Error("Missing OPENAI_CHAT_MODEL");
	}
	return "gpt-5.4-mini";
}

/**
 * Chat model for student doubt chat only (`OPENAI_DOUBT_CHAT_MODEL`).
 * When unset, uses {@link getOpenAIChatModel} so practice generation and doubt
 * can share one config until you explicitly split models.
 */
export function getOpenAIDoubtChatModel(): string {
	const model = readTrimmedEnv("OPENAI_DOUBT_CHAT_MODEL");
	if (model) return model;
	return getOpenAIChatModel();
}

/**
 * Optional fallback chat model used when the primary returns 429 / overload
 * / timeout. Useful so a single model deprecation or capacity blip doesn't
 * fail every generation. Returns `null` when no fallback is configured.
 */
export function getOpenAIChatModelFallback(): string | null {
	const model = readTrimmedEnv("OPENAI_CHAT_MODEL_FALLBACK");
	if (model) return model;
	return null;
}

/**
 * Practice-generation primary model. When unset, falls back to OPENAI_CHAT_MODEL
 * so existing deployments keep current behavior.
 */
export function getOpenAIPracticeChatModel(): string {
	const model = readTrimmedEnv("OPENAI_PRACTICE_CHAT_MODEL");
	if (model) return model;
	return getOpenAIChatModel();
}

/**
 * Practice-generation fallback model. When unset, falls back to
 * OPENAI_CHAT_MODEL_FALLBACK.
 */
export function getOpenAIPracticeChatModelFallback(): string | null {
	const model = readTrimmedEnv("OPENAI_PRACTICE_CHAT_MODEL_FALLBACK");
	if (model) return model;
	return getOpenAIChatModelFallback();
}

/**
 * When false (`AI_PROVIDER_FALLBACK_ENABLED=false`), DeepSeek 429/503 failures
 * do not retry on OpenAI. Default: enabled.
 */
export function isAiProviderFallbackEnabled(): boolean {
	return process.env.AI_PROVIDER_FALLBACK_ENABLED?.trim().toLowerCase() !== "false";
}

// ============================================================
// DeepSeek (V4 Pro) — used when the model router selects "deepseek"
// for a feature. OpenAI helpers above remain the fallback path
// (vision turns, env_default=openai), so both providers can coexist.
// ============================================================

/** DeepSeek API key — server-only. Validation deferred until a feature actually routes to DeepSeek. */
export function getDeepSeekApiKey(): string {
	const key = process.env.DEEPSEEK_API_KEY?.trim();
	if (!key) throw new Error("Missing DEEPSEEK_API_KEY");
	return key;
}

/**
 * Optional baseURL override for self-hosted gateways. Defaults to https://api.deepseek.com.
 *
 * Important: `readTrimmedEnv` returns `""` (not `undefined`) when the env var
 * is unset. The DeepSeek SDK uses `options.baseURL ?? DEFAULT` — `??` only
 * fires on null/undefined, so passing `""` here makes the SDK build URLs like
 * `"" + "/chat/completions"` → relative URL → fetch failure. Coerce empty to
 * undefined so the SDK default kicks in.
 */
export function getDeepSeekBaseUrl(): string | undefined {
	const v = readTrimmedEnv("DEEPSEEK_BASE_URL");
	return v.length > 0 ? v : undefined;
}

/** Default chat model. V4 Pro is the migration target; older `deepseek-chat` is auto-mapped by DeepSeek until 2026-07-24. */
export function getDeepSeekChatModel(): string {
	const model = readTrimmedEnv("DEEPSEEK_CHAT_MODEL");
	if (model) return model;
	return "deepseek-v4-pro";
}

/**
 * Per-feature overrides — when unset, fall back to {@link getDeepSeekChatModel}.
 *
 * `readTrimmedEnv` returns `""` (not `undefined`) for unset vars, so `??` does
 * not short-circuit — guard explicitly with a truthiness check.
 */
export function getDeepSeekDoubtChatModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_DOUBT_CHAT_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

export function getDeepSeekPracticeChatModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_PRACTICE_CHAT_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

export function getDeepSeekGradingChatModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_GRADING_CHAT_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

/**
 * Reasoning effort for V4 reasoning models. `medium` is the default after the
 * parallel-batched generation rollout — `high` burned ~3-5 minutes of CoT on
 * single-call 15-question gens; `medium` is enough to keep quality steady at a
 * fraction of the latency. Override per-environment with DEEPSEEK_REASONING_EFFORT.
 */
export type DeepSeekReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export function getDeepSeekReasoningEffort(): DeepSeekReasoningEffort {
	const raw = readTrimmedEnv("DEEPSEEK_REASONING_EFFORT")?.toLowerCase();
	if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max") {
		return raw;
	}
	return "medium";
}

/**
 * Per-feature thinking modes. Practice generation has high variance in how
 * much CoT actually helps: blueprint is structural (slot allocation, topic
 * mapping) and rarely benefits from thinking; visual enrichment + grade
 * summary are formatting-heavy. The big quality lever is the main practice
 * generation + grade-chunk passes.
 *
 * `disabled` skips CoT entirely (best latency, lowest cost). `enabled` is
 * the V4 Pro default. `adaptive` lets the model decide per-turn.
 */
export type DeepSeekThinkingMode = "enabled" | "disabled" | "adaptive";

function readThinkingMode(envName: string, fallback: DeepSeekThinkingMode): DeepSeekThinkingMode {
	const raw = readTrimmedEnv(envName)?.toLowerCase();
	if (raw === "enabled" || raw === "disabled" || raw === "adaptive") return raw;
	return fallback;
}

export function getDeepSeekBlueprintThinking(): DeepSeekThinkingMode {
	return readThinkingMode("DEEPSEEK_BLUEPRINT_THINKING", "enabled");
}

export function getDeepSeekVisualEnrichmentThinking(): DeepSeekThinkingMode {
	return readThinkingMode("DEEPSEEK_VISUAL_ENRICHMENT_THINKING", "enabled");
}

export function getDeepSeekGradeSummaryThinking(): DeepSeekThinkingMode {
	return readThinkingMode("DEEPSEEK_GRADE_SUMMARY_THINKING", "enabled");
}

/**
 * Per-feature model overrides — Flash for structural/format calls, Pro for
 * quality-critical generation + per-chunk grading. When unset, falls back to
 * {@link getDeepSeekChatModel}.
 *
 * `readTrimmedEnv` returns `""` for unset vars (not undefined), so the
 * truthy guard is required — `?? fallback` would never fire.
 */
export function getDeepSeekBlueprintModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_BLUEPRINT_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

export function getDeepSeekVisualEnrichmentModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_VISUAL_ENRICHMENT_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

export function getDeepSeekGradeSummaryModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_GRADE_SUMMARY_MODEL");
	return v.length > 0 ? v : getDeepSeekChatModel();
}

/**
 * Variant selector for the practice generation pipeline.
 *
 * - `5call` (default): blueprint LLM → main gen → visual enrich ×3 (parallel)
 * - `3call`: deterministic blueprint → main gen → single visual-enrich call → Flash structure+sanity validator
 *
 * The 3-call variant trades a small quality safety net (LLM-derived
 * visual_idea per slot) for ~25s + ₹0.20 saved per generation. It's feature-
 * flagged so the team can A/B both pipelines against the same student traffic.
 */
export type PracticePipelineVariant = "5call" | "3call";

export function getPracticePipelineVariant(): PracticePipelineVariant {
	const raw = readTrimmedEnv("PRACTICE_PIPELINE_VARIANT").toLowerCase();
	return raw === "3call" ? "3call" : "5call";
}

/**
 * Splits the single 15- or 30-question structured generation call into four
 * concurrent calls (MCQ / FIB / SA / LA) that share an identical cacheable
 * prompt prefix and diverge only in a per-batch BATCH CONTRACT tail. Cuts
 * wall-clock by roughly the long-answer-batch latency floor at the cost of
 * ~1.4× input tokens (offset by DeepSeek prompt caching).
 *
 * Off by default while we A/B against the single-call baseline; flip
 * PRACTICE_PARALLEL_BATCHES=true in env to opt a deployment in.
 */
export function getPracticeParallelBatchesEnabled(): boolean {
	return readTrimmedEnv("PRACTICE_PARALLEL_BATCHES").toLowerCase() === "true";
}

/**
 * Forces the LLM blueprint path (V4 Flash by default via
 * DEEPSEEK_BLUEPRINT_MODEL) regardless of pipeline variant. Without this
 * flag, the `3call` variant uses a deterministic blueprint to skip a Flash
 * round-trip. With this flag, you keep `3call`'s visual optimizations
 * (no retry rounds, no deterministic fallback visuals) while regaining
 * the LLM-derived per-slot `visual_intent` and `skill_target`.
 *
 * Off by default; flip PRACTICE_BLUEPRINT_LLM=true to opt in.
 */
export function getPracticeBlueprintLlmEnabled(): boolean {
	return readTrimmedEnv("PRACTICE_BLUEPRINT_LLM").toLowerCase() === "true";
}

/**
 * V2 batch contract: per-batch system prompts (stripped of irrelevant sections),
 * per-batch HARD GATES that override the test-wide ones, SISTER_BATCHES_BRIEF
 * cross-batch context, per-batch cognitive-demand budgets, post-merge invariant
 * audit, and a Flash test-wide editor pass. Requires PRACTICE_PARALLEL_BATCHES.
 *
 * Off by default; flip PRACTICE_BATCH_CONTRACT_V2=true to opt in.
 */
export function getPracticeBatchContractV2Enabled(): boolean {
	return readTrimmedEnv("PRACTICE_BATCH_CONTRACT_V2").toLowerCase() === "true";
}

/**
 * When the V2 batch contract is on, also runs a single Flash editor pass after
 * merge that rebalances MCQ A/B/C/D distribution, rewrites near-duplicate
 * stems, and tightens the difficulty ramp. Adds one ~3-5s Flash call.
 *
 * Defaults to true when V2 is enabled; set PRACTICE_BATCH_EDITOR_PASS=false
 * to disable independently of the V2 flag.
 */
export function getPracticeBatchEditorPassEnabled(): boolean {
	const raw = readTrimmedEnv("PRACTICE_BATCH_EDITOR_PASS").toLowerCase();
	if (raw === "false") return false;
	return getPracticeBatchContractV2Enabled();
}

/**
 * Flash model used for the final structure+sanity validator in the 3-call
 * variant. Falls back to the default Flash override so changing one env var
 * propagates; falls back to the global chat model if neither is set.
 */
export function getDeepSeekValidationModel(): string {
	const v = readTrimmedEnv("DEEPSEEK_VALIDATION_MODEL");
	if (v.length > 0) return v;
	return getDeepSeekVisualEnrichmentModel(); // same Flash route as enrichment by default
}

export function getDeepSeekValidationThinking(): DeepSeekThinkingMode {
	return readThinkingMode("DEEPSEEK_VALIDATION_THINKING", "disabled");
}

// ============================================================
// Billing / SaaS
// ============================================================

/** Razorpay server-side key id. */
export function getRazorpayKeyId(): string {
	const key = readTrimmedEnv("RAZORPAY_KEY_ID");
	if (!key) throw new Error("Missing RAZORPAY_KEY_ID");
	return key;
}

/** Razorpay server-side key secret (never expose to the browser). */
export function getRazorpayKeySecret(): string {
	const key = readTrimmedEnv("RAZORPAY_KEY_SECRET");
	if (!key) throw new Error("Missing RAZORPAY_KEY_SECRET");
	return key;
}

/** Shared webhook secret configured in Razorpay Dashboard → Webhooks. */
export function getRazorpayWebhookSecret(): string {
	const key = readTrimmedEnv("RAZORPAY_WEBHOOK_SECRET");
	if (!key) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
	return key;
}

/** Public key id embedded in Razorpay Checkout on the client. */
export function getPublicRazorpayKeyId(): string {
	const key =
		readTrimmedEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") || readTrimmedEnv("RAZORPAY_KEY_ID");
	if (!key) throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID (or RAZORPAY_KEY_ID for server-only setups)");
	return key;
}

/**
 * Gate for SaaS quota enforcement. Set `SAAS_ENFORCEMENT=true` in production; keep
 * it off in dev so existing seed students do not get locked out mid-session.
 */
export function isSaasEnforcementEnabled(): boolean {
	return readTrimmedEnv("SAAS_ENFORCEMENT").toLowerCase() === "true";
}
