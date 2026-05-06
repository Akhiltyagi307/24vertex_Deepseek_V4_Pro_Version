import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contentBlacklist } from "@/db/schema/content-blacklist";
import { moderationFlags } from "@/db/schema/moderation-flags";
import { isModerationPreCheckEnabled } from "@/lib/admin/feature-flags";

const DEFAULT_PROFANITY = /\b(fuck|shit|bitch|slut|n[i1]g+[e3]r)\b/i;

function parseEmbeddingVector(raw: unknown): number[] | null {
	if (Array.isArray(raw) && raw.length === 1536 && raw.every((x) => typeof x === "number")) {
		return raw as number[];
	}
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (Array.isArray(parsed) && parsed.length === 1536) {
				return parsed.map((x) => Number(x)) as number[];
			}
		} catch {
			return null;
		}
	}
	return null;
}

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
	| { ok: false; reason: string; source: "profanity" | "regex_blacklist" | "embedding_blacklist" };

export type PerQuestionFlag = {
	index: number;
	reason: string;
	source: "profanity" | "regex_blacklist";
};
export type PerQuestionModerationResult =
	| { ok: true; flagged: [] }
	| { ok: false; flagged: PerQuestionFlag[] };

/**
 * Per-question regex + profanity moderation. Free (no embedding call). Use this
 * before the blob-level {@link moderatePracticeGenerationText} so a single
 * tainted question does not invalidate the whole generation — caller can drop
 * the flagged indices and keep the rest.
 */
export async function moderatePracticeQuestionsPerItem(
	questionTexts: string[],
): Promise<PerQuestionModerationResult> {
	if (!(await isModerationPreCheckEnabled()) || questionTexts.length === 0) {
		return { ok: true, flagged: [] };
	}

	const rules = await db
		.select()
		.from(contentBlacklist)
		.where(eq(contentBlacklist.appliesTo, "question_generator"));
	const compiledRegex: { id: string; re: RegExp }[] = [];
	for (const row of rules) {
		if (row.patternType !== "regex") continue;
		try {
			compiledRegex.push({ id: row.id, re: new RegExp(row.pattern, "i") });
		} catch {
			/* invalid regex — skip */
		}
	}

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
 * Regex blacklist + optional embedding similarity (≥0.95) against `content_blacklist`.
 *
 * Use {@link moderatePracticeQuestionsPerItem} first for per-question regex /
 * profanity checks; this blob pass exists primarily for the embedding rule
 * which is most meaningful at the test-as-a-whole level.
 */
export async function moderatePracticeGenerationText(blob: string): Promise<ModerationOutcome> {
	if (!(await isModerationPreCheckEnabled())) {
		return { ok: true };
	}
	if (DEFAULT_PROFANITY.test(blob)) {
		return { ok: false, reason: "profanity_pattern", source: "profanity" };
	}

	const rules = await db
		.select()
		.from(contentBlacklist)
		.where(eq(contentBlacklist.appliesTo, "question_generator"));

	for (const row of rules) {
		if (row.patternType === "regex") {
			try {
				const re = new RegExp(row.pattern, "i");
				if (re.test(blob)) {
					return { ok: false, reason: `regex:${row.id}`, source: "regex_blacklist" };
				}
			} catch {
				/* invalid regex — skip */
			}
		}
	}

	const embeddingRows = rules.filter((r) => r.patternType === "embedding" && r.embedding);
	if (embeddingRows.length === 0) {
		return { ok: true };
	}

	const generated = await embedText1536(blob);
	if (!generated) {
		return { ok: true };
	}

	for (const row of embeddingRows) {
		const ref = parseEmbeddingVector(row.embedding);
		if (!ref) continue;
		const sim = cosineSimilarity(generated, ref);
		if (sim >= 0.95) {
			return { ok: false, reason: `embedding_similarity_${sim.toFixed(3)}`, source: "embedding_blacklist" };
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
