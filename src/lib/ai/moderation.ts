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

/**
 * Server-side moderation for AI practice output (PDR §4.27).
 * Regex blacklist + optional embedding similarity (≥0.95) against `content_blacklist`.
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
