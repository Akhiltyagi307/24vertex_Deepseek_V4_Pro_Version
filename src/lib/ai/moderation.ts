import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contentBlacklist } from "@/db/schema/content-blacklist";
import { moderationFlags } from "@/db/schema/moderation-flags";
import { isModerationPreCheckEnabled } from "@/lib/admin/feature-flags";

const DEFAULT_PROFANITY = /\b(fuck|shit|bitch|slut|n[i1]g+[e3]r)\b/i;

/**
 * Cosine similarity helper. Retained for the admin blacklist authoring UI
 * (`/admin/moderation/blacklist`) which still supports creating embedding-
 * pattern rules. The generation-time pipeline no longer evaluates those rules
 * (post-DeepSeek-migration; see {@link moderatePracticeGenerationText}), so
 * existing embedding rules are inert — but the admin tool keeps building them
 * for the day we wire a non-OpenAI embedding provider back in.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		na += a[i]! * a[i]!;
		nb += b[i]! * b[i]!;
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}

/**
 * Generates a 1536-dim embedding for the admin blacklist authoring flow only.
 * Calls OpenAI directly with the embeddings API — DeepSeek has none. Returns
 * null on any failure so the admin form can fall back to a regex pattern.
 *
 * Not used at generation time anymore; see {@link moderatePracticeGenerationText}.
 */
export async function embedText1536(text: string): Promise<number[] | null> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) return null;
	const input = text.slice(0, 12_000);
	try {
		const res = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "text-embedding-3-small",
				input,
				dimensions: 1536,
			}),
			signal: AbortSignal.timeout(25_000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { data?: { embedding?: number[] }[] };
		const emb = json.data?.[0]?.embedding;
		return Array.isArray(emb) && emb.length === 1536 ? emb : null;
	} catch {
		return null;
	}
}

export type ModerationOutcome =
	| { ok: true }
	| { ok: false; reason: string; source: "profanity" | "regex_blacklist" };

export type PerQuestionFlag = {
	index: number;
	reason: string;
	source: "profanity" | "regex_blacklist";
};
export type PerQuestionModerationResult =
	| { ok: true; flagged: [] }
	| { ok: false; flagged: PerQuestionFlag[] };

export type CompiledBlacklistRule = { id: string; re: RegExp };

/**
 * Shared moderation inputs (feature-flag state + compiled regex blacklist).
 * A caller that runs both {@link moderatePracticeQuestionsPerItem} and
 * {@link moderatePracticeGenerationText} back-to-back (the generation pipeline)
 * can load this once and pass it into both, so the flag query and the blacklist
 * query+compile happen a single time instead of once per pass.
 */
export type ModerationContext = {
	enabled: boolean;
	blacklist: CompiledBlacklistRule[];
};

async function loadQuestionGeneratorRegexBlacklist(): Promise<CompiledBlacklistRule[]> {
	const rules = await db
		.select()
		.from(contentBlacklist)
		.where(eq(contentBlacklist.appliesTo, "question_generator"));
	const compiledRegex: CompiledBlacklistRule[] = [];
	for (const row of rules) {
		if (row.patternType !== "regex") continue;
		try {
			compiledRegex.push({ id: row.id, re: new RegExp(row.pattern, "i") });
		} catch {
			/* invalid regex — skip */
		}
	}
	return compiledRegex;
}

/** Load the shared {@link ModerationContext} once for back-to-back passes. */
export async function loadModerationContext(): Promise<ModerationContext> {
	if (!(await isModerationPreCheckEnabled())) {
		return { enabled: false, blacklist: [] };
	}
	return { enabled: true, blacklist: await loadQuestionGeneratorRegexBlacklist() };
}

/**
 * Per-question regex + profanity moderation. Free (no embedding call). Use this
 * before the blob-level {@link moderatePracticeGenerationText} so a single
 * tainted question does not invalidate the whole generation — caller can drop
 * the flagged indices and keep the rest.
 *
 * Pass a shared {@link ModerationContext} to reuse one flag + blacklist load
 * across both passes; omit it and the function loads its own (standalone use).
 */
export async function moderatePracticeQuestionsPerItem(
	questionTexts: string[],
	ctx?: ModerationContext,
): Promise<PerQuestionModerationResult> {
	const enabled = ctx ? ctx.enabled : await isModerationPreCheckEnabled();
	if (!enabled || questionTexts.length === 0) {
		return { ok: true, flagged: [] };
	}

	const compiledRegex = ctx ? ctx.blacklist : await loadQuestionGeneratorRegexBlacklist();

	const flagged: PerQuestionFlag[] = [];
	for (let i = 0; i < questionTexts.length; i++) {
		const text = questionTexts[i] ?? "";
		if (DEFAULT_PROFANITY.test(text)) {
			flagged.push({ index: i, reason: "profanity_pattern", source: "profanity" });
			continue;
		}
		for (const { id, re } of compiledRegex) {
			if (re.test(text)) {
				flagged.push({ index: i, reason: `regex:${id}`, source: "regex_blacklist" });
				break;
			}
		}
	}
	return flagged.length === 0 ? { ok: true, flagged: [] } : { ok: false, flagged };
}

/**
 * Server-side moderation for AI practice output (PDR §4.27).
 * Regex blacklist + profanity check against `content_blacklist`.
 *
 * Use {@link moderatePracticeQuestionsPerItem} first for per-question regex /
 * profanity checks; this blob pass catches patterns that only appear when the
 * full test JSON is inspected together (e.g. blacklist phrases split across
 * question + options).
 *
 * Embedding-based similarity moderation was removed when the LLM backend
 * migrated to DeepSeek V4 Pro — DeepSeek has no embeddings API and the
 * embedding rules carried marginal value (we kept all the regex coverage).
 * See docs/deepseek-migration-plan.md §4.5.
 */
export async function moderatePracticeGenerationText(
	blob: string,
	ctx?: ModerationContext,
): Promise<ModerationOutcome> {
	const enabled = ctx ? ctx.enabled : await isModerationPreCheckEnabled();
	if (!enabled) {
		return { ok: true };
	}
	if (DEFAULT_PROFANITY.test(blob)) {
		return { ok: false, reason: "profanity_pattern", source: "profanity" };
	}

	const compiledRegex = ctx ? ctx.blacklist : await loadQuestionGeneratorRegexBlacklist();
	for (const { id, re } of compiledRegex) {
		if (re.test(blob)) {
			return { ok: false, reason: `regex:${id}`, source: "regex_blacklist" };
		}
	}

	return { ok: true };
}

export async function insertHeuristicModerationFlag(input: {
	entityType: string;
	entityId: string;
	source: string;
	reason: string;
	severity?: "low" | "medium" | "high" | "critical";
}): Promise<void> {
	await db.insert(moderationFlags).values({
		entityType: input.entityType,
		entityId: input.entityId,
		reportedBy: null,
		source: input.source,
		reason: input.reason,
		severity: input.severity ?? "medium",
		status: "open",
	});
}
