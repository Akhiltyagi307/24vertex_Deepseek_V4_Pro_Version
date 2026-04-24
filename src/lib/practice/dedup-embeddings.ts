import { embedMany } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";

const EMBEDDING_MODEL_ID = process.env.PRACTICE_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
const DUPLICATE_COSINE_THRESHOLD = Number.parseFloat(
	process.env.PRACTICE_DUPLICATE_COSINE_THRESHOLD ?? "0.92",
);

export type GeneratedForDedup = {
	topic_id: string;
	question_text: string;
};

export async function embedQuestionTexts(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];
	const provider = getOpenAIProvider();
	const model = provider.textEmbeddingModel(EMBEDDING_MODEL_ID);
	const { embeddings } = await embedMany({
		model,
		values: texts,
	});
	return embeddings;
}

function toPgVector(vec: number[]): string {
	return `[${vec.join(",")}]`;
}

/**
 * Returns indices into `generated` that are too similar to questions the
 * student has seen before (same topic only). Similarity uses pgvector's `<=>`
 * cosine distance: similarity = 1 - distance.
 *
 * Consumers should regenerate only the duplicates (or the whole test if that
 * path is simpler), then re-check.
 */
export async function findDuplicatesAgainstStudent(
	supabase: SupabaseClient,
	studentId: string,
	generated: GeneratedForDedup[],
	embeddings: number[][],
): Promise<number[]> {
	if (generated.length === 0 || embeddings.length !== generated.length) return [];

	const topicIds = [...new Set(generated.map((g) => g.topic_id))];
	if (topicIds.length === 0) return [];

	// Pull a cap of past question embeddings for this student on these topics.
	const { data: pastRows, error } = await supabase
		.from("questions")
		.select("id, topic_id, embedding, test_id")
		.in("topic_id", topicIds)
		.not("embedding", "is", null)
		.limit(500);

	if (error || !pastRows?.length) return [];

	// Filter to questions from this student's own tests.
	const testIds = [...new Set(pastRows.map((r) => r.test_id as string))];
	if (testIds.length === 0) return [];
	const { data: testRows } = await supabase
		.from("tests")
		.select("id")
		.in("id", testIds)
		.eq("student_id", studentId);
	const ownedTestIds = new Set((testRows ?? []).map((r) => r.id as string));

	const pastByTopic = new Map<string, Array<{ embedding: number[] }>>();
	for (const r of pastRows) {
		if (!ownedTestIds.has(r.test_id as string)) continue;
		const raw = r.embedding as unknown;
		const vec = Array.isArray(raw)
			? (raw as number[])
			: typeof raw === "string"
				? parsePgVector(raw)
				: null;
		if (!vec) continue;
		const key = r.topic_id as string;
		if (!pastByTopic.has(key)) pastByTopic.set(key, []);
		pastByTopic.get(key)!.push({ embedding: vec });
	}

	const dupes: number[] = [];
	for (let i = 0; i < generated.length; i++) {
		const g = generated[i]!;
		const vec = embeddings[i]!;
		const pool = pastByTopic.get(g.topic_id);
		if (!pool || pool.length === 0) continue;
		let maxSim = 0;
		for (const p of pool) {
			const s = cosineSim(vec, p.embedding);
			if (s > maxSim) maxSim = s;
			if (s >= DUPLICATE_COSINE_THRESHOLD) break;
		}
		if (maxSim >= DUPLICATE_COSINE_THRESHOLD) dupes.push(i);
	}
	return dupes;
}

/**
 * Writes embeddings to `questions.embedding`. Uses service-role client because
 * the authenticated role's column-level grant still allows embedding updates,
 * but students shouldn't be inserting arbitrary vectors via policies anyway.
 */
export async function persistQuestionEmbeddings(
	serviceClient: SupabaseClient,
	rows: Array<{ question_id: string; embedding: number[] }>,
): Promise<void> {
	for (const row of rows) {
		await serviceClient
			.from("questions")
			.update({ embedding: toPgVector(row.embedding) })
			.eq("id", row.question_id);
	}
}

function cosineSim(a: number[], b: number[]): number {
	if (a.length !== b.length) return 0;
	let dot = 0;
	let magA = 0;
	let magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		magA += a[i]! * a[i]!;
		magB += b[i]! * b[i]!;
	}
	if (magA === 0 || magB === 0) return 0;
	return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parsePgVector(s: string): number[] | null {
	const t = s.trim();
	if (!t.startsWith("[") || !t.endsWith("]")) return null;
	const inner = t.slice(1, -1);
	if (inner.length === 0) return [];
	const parts = inner.split(",");
	const out = new Array<number>(parts.length);
	for (let i = 0; i < parts.length; i++) {
		const v = Number.parseFloat(parts[i]!);
		if (!Number.isFinite(v)) return null;
		out[i] = v;
	}
	return out;
}
