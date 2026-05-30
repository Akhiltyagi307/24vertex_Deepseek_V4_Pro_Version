import type { PracticeGenerationOutput } from "./generation-schema";
import type { PracticeGroundingMeta } from "./user-message";
import { stemNeedsVisualHint } from "./visuals/stem-visual-hints";

export type PracticeQualityGateFailureCode =
	| "near_duplicate_stems"
	| "topic_concentration"
	| "stem_references_missing_visual"
	| "visual_label_mismatch"
	| "visual_leaks_answer"
	| "chunk_alignment_weak";

export type PracticeQualityGateDetails = Record<string, number | string | number[]>;

export type PracticeQualityGateResult =
	| { ok: true }
	| { ok: false; code: PracticeQualityGateFailureCode; message: string; details?: PracticeQualityGateDetails };

/** Quality gates that can be repaired with VISUAL_FIX_MODE (targeted regen). */
export const VISUAL_FIX_ELIGIBLE_GATE_CODES = new Set<PracticeQualityGateFailureCode>([
	"stem_references_missing_visual",
	"visual_label_mismatch",
	"visual_leaks_answer",
	"chunk_alignment_weak",
]);

export type EvaluatePracticeGenerationQualityInput = {
	questions: PracticeGenerationOutput["questions"];
	/** Number of topic IDs selected/allowed for this generation request. */
	allowedTopicCount?: number;
	/**
	 * In the rebuilt visual pipeline, base drafting emits `visual: null` first
	 * and a later enrichment/fallback pass attaches visuals. During that
	 * pre-enrichment phase, stems may intentionally cue a forthcoming passage,
	 * figure, or table, so this specific gate must be deferred.
	 */
	skipMissingVisualGate?: boolean;
	/** When set with sufficient corpus text, enforces lexical overlap with topic chunks (skipped for `no_context`). */
	chunkAlignment?: {
		corpusByTopicId: ReadonlyMap<string, string>;
		contextQuality: NonNullable<PracticeGroundingMeta["context_quality"]>;
	};
};

const NEAR_DUPLICATE_SIMILARITY_THRESHOLD = 0.9;
const MAX_TOPIC_SHARE = 0.65;

/** Off by default in .env.example — set to "false" to skip stem↔chunk token overlap gate. */
function isChunkAlignmentLexicalEnabled(): boolean {
	return process.env.PRACTICE_CHUNK_ALIGN_LEXICAL !== "false";
}

const STEM_STOPWORDS = new Set([
	"that",
	"this",
	"with",
	"from",
	"your",
	"have",
	"been",
	"were",
	"said",
	"each",
	"which",
	"their",
	"time",
	"will",
	"about",
	"into",
	"more",
	"than",
	"other",
	"some",
	"what",
	"when",
	"where",
	"after",
	"before",
	"below",
	"above",
	"shown",
	"here",
	"find",
	"calculate",
	"determine",
	"evaluate",
	"following",
	"question",
	"based",
	"given",
	"figure",
	"diagram",
	"table",
	"graph",
	"circuit",
	"structure",
	"image",
	"drawing",
	"students",
	"student",
	"read",
	"identify",
	"select",
	"choose",
	"correct",
	"best",
	"statement",
	"passage",
	"excerpt",
]);

function normalizeStem(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
}

function diceSimilarity(a: string[], b: string[]): number {
	if (a.length === 0 && b.length === 0) return 1;
	if (a.length === 0 || b.length === 0) return 0;
	const aSet = new Set(a);
	const bSet = new Set(b);
	let intersection = 0;
	for (const token of aSet) {
		if (bSet.has(token)) intersection++;
	}
	return (2 * intersection) / (aSet.size + bSet.size);
}

function findNearDuplicatePairCount(questions: PracticeGenerationOutput["questions"]): number {
	let nearDuplicatePairs = 0;
	for (let i = 0; i < questions.length; i++) {
		const a = normalizeStem(questions[i]?.question_text ?? "");
		for (let j = i + 1; j < questions.length; j++) {
			const b = normalizeStem(questions[j]?.question_text ?? "");
			if (diceSimilarity(a, b) >= NEAR_DUPLICATE_SIMILARITY_THRESHOLD) {
				nearDuplicatePairs++;
			}
		}
	}
	return nearDuplicatePairs;
}

/**
 * Short domain tokens that survive the length-≥4 filter — accounting,
 * finance, business, and ratio abbreviations that DO appear in topic
 * corpora and stems. Without these, `Rs.`, `Dr.`, `Cr.`, `GST`, `P&L`
 * (post-strip → `p l` → `p` and `l`) and similar collapse to <4 chars
 * and the chunk-alignment gate cannot use them as signal — which is
 * the structural reason narrow-corpus subjects like Financial
 * Accounting Part 2 fire `chunk_alignment_weak` at high rates even on
 * faithful restatements of the source chunks.
 */
const SHORT_DOMAIN_TOKENS = new Set([
	"dr",
	"cr",
	"rs",
	"gst",
	"tds",
	"pnl",
	"agm",
	"egm",
	"fy",
	"ay",
	"hra",
	"roi",
	"roe",
	"eps",
	"ebit",
	"mou",
	"npv",
	"irr",
	"crr",
	"slr",
	"rbi",
	"sebi",
	"ifrs",
	"gaap",
	"ind",
	"as",
]);

/**
 * Content words (length ≥ 4) from the stem for overlap with topic corpus,
 * plus a small allowlist of domain abbreviations from {@link SHORT_DOMAIN_TOKENS}.
 */
function extractSignificantStemTokens(stem: string): string[] {
	const lower = stem.toLowerCase().replace(/[^a-z0-9]+/g, " ");
	const parts = lower.split(/\s+/).filter(Boolean);
	const out: string[] = [];
	for (const p of parts) {
		if (p.length < 4 && !SHORT_DOMAIN_TOKENS.has(p)) continue;
		if (STEM_STOPWORDS.has(p)) continue;
		out.push(p);
	}
	return out;
}

/**
 * Count the unique tokens that the alignment gate would consider as
 * "significant" inside a given corpus. Used to relax the required-match
 * threshold when the topic corpus is small (e.g. Financial Accounting
 * Part 2 topics whose median unique gate-token count is ~99 vs ~375 for
 * Business Studies). Cheap because the function runs once per topic at
 * gate evaluation time, not per question.
 */
function countUniqueCorpusGateTokens(corpus: string): number {
	const lower = corpus.toLowerCase().replace(/[^a-z0-9]+/g, " ");
	const seen = new Set<string>();
	for (const p of lower.split(/\s+/)) {
		if (!p) continue;
		if (p.length < 4 && !SHORT_DOMAIN_TOKENS.has(p)) continue;
		if (STEM_STOPWORDS.has(p)) continue;
		seen.add(p);
	}
	return seen.size;
}

function normalizeLeakText(s: string): string {
	return s
		.toLowerCase()
		.replace(/\$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** Caption/altText only — avoids spec numeric stimulus false positives. */
const VISUAL_COPY_BANNED: RegExp[] = [
	/\banswer\s+is\s+[abcd]\b/i,
	/\bcorrect\s+(option|choice)\s*[:.]?\s*[abcd]\b/i,
	/\boption\s+[abcd]\s+is\s+(correct|right|true)\b/i,
	/\bthe\s+correct\s+(answer|option|choice)\s+(is|are)\b/i,
	/\btherefore\s+.{0,120}\b(is|are)\s+(correct|true|false)\b/i,
];

function gateVisualLeaksAnswer(questions: PracticeGenerationOutput["questions"]): PracticeQualityGateResult {
	const failedIndexes: number[] = [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q?.visual) continue;
		const stemNorm = normalizeLeakText(q.question_text);
		const pool = normalizeLeakText(`${q.visual.caption} ${q.visual.altText}`);

		let bad = false;
		for (const re of VISUAL_COPY_BANNED) {
			if (re.test(q.visual.caption) || re.test(q.visual.altText)) {
				bad = true;
				break;
			}
		}

		if (!bad) {
			const ca = String(q.answer_key.correct_answer ?? "").trim();
			const candidates: string[] = [];
			if (q.question_type === "multiple_choice" && q.options && /^[ABCD]$/i.test(ca)) {
				const key = ca.toUpperCase() as "A" | "B" | "C" | "D";
				const optText = q.options[key];
				if (optText && optText.length >= 5) candidates.push(normalizeLeakText(optText));
			}
			if (ca.length >= 5 && !/^[ABCD]$/i.test(ca)) {
				candidates.push(normalizeLeakText(ca));
				for (const part of ca.split(/[.;,:]+/)) {
					const p = part.trim();
					if (p.length >= 6) candidates.push(normalizeLeakText(p));
				}
			}

			for (const c of candidates) {
				if (c.length < 5) continue;
				if (!pool.includes(c)) continue;
				if (stemNorm.includes(c)) continue;
				bad = true;
				break;
			}
		}

		if (bad) failedIndexes.push(i);
	}

	if (failedIndexes.length === 0) return { ok: true };
	return {
		ok: false,
		code: "visual_leaks_answer",
		message: `${failedIndexes.length} question(s) have a caption or altText that may reveal the keyed answer. Regenerating with neutral descriptions only.`,
		details: { offenderCount: failedIndexes.length, failedIndexes },
	};
}

/** Below this unique-token count the corpus is considered narrow and the
 * gate relaxes its match requirement by 1 (floor 1). Tuned against the
 * observed median for narrow-corpus subjects (~99 unique gate-tokens for
 * FA Part 2) vs broad ones (~375 for Business Studies). */
const NARROW_CORPUS_UNIQUE_TOKEN_THRESHOLD = 180;

function gateChunkAlignmentLexical(
	questions: PracticeGenerationOutput["questions"],
	corpusByTopicId: ReadonlyMap<string, string>,
	contextQuality: NonNullable<PracticeGroundingMeta["context_quality"]>,
): PracticeQualityGateResult {
	if (!isChunkAlignmentLexicalEnabled()) return { ok: true };
	if (contextQuality === "no_context") return { ok: true };

	// Cache narrow-ness per topic so we don't tokenize the same corpus once
	// per question on the same topic.
	const narrowCorpusByTopic = new Map<string, boolean>();
	const isNarrow = (topicId: string, corpus: string): boolean => {
		const cached = narrowCorpusByTopic.get(topicId);
		if (cached !== undefined) return cached;
		const narrow = countUniqueCorpusGateTokens(corpus) < NARROW_CORPUS_UNIQUE_TOKEN_THRESHOLD;
		narrowCorpusByTopic.set(topicId, narrow);
		return narrow;
	};

	const failedIndexes: number[] = [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q) continue;
		const corpus = corpusByTopicId.get(q.topic_id) ?? "";
		if (corpus.length < 80) continue;

		const tokens = extractSignificantStemTokens(q.question_text);
		if (tokens.length < 3) continue;

		const corpusL = corpus.toLowerCase();
		const matches = tokens.filter((t) => corpusL.includes(t));

		let required = 1;
		if (tokens.length >= 4) required = 2;
		if (tokens.length >= 10) required = Math.max(2, Math.floor(tokens.length * 0.25));
		if (isNarrow(q.topic_id, corpus)) required = Math.max(1, required - 1);

		if (matches.length < required) failedIndexes.push(i);
	}

	if (failedIndexes.length === 0) return { ok: true };
	return {
		ok: false,
		code: "chunk_alignment_weak",
		message: `${failedIndexes.length} question stem(s) show weak overlap with topic grounding text. Regenerating to align with supplied chunks.`,
		details: { weakStemCount: failedIndexes.length, failedIndexes },
	};
}

export function evaluatePracticeGenerationQuality(input: EvaluatePracticeGenerationQualityInput): PracticeQualityGateResult {
	const questions = input.questions;
	if (questions.length === 0) return { ok: true };

	const nearDuplicatePairs = findNearDuplicatePairCount(questions);
	if (nearDuplicatePairs > 0) {
		return {
			ok: false,
			code: "near_duplicate_stems",
			message: "Generated questions are too similar. Regenerating for better variety.",
			details: { nearDuplicatePairs },
		};
	}

	const byTopic = new Map<string, number>();
	for (const q of questions) {
		byTopic.set(q.topic_id, (byTopic.get(q.topic_id) ?? 0) + 1);
	}
	const maxTopicCount = Math.max(...byTopic.values());
	const maxTopicShare = maxTopicCount / questions.length;
	if ((input.allowedTopicCount ?? Number.POSITIVE_INFINITY) > 1 && maxTopicShare > MAX_TOPIC_SHARE) {
		return {
			ok: false,
			code: "topic_concentration",
			message: "Generated questions are overly concentrated in one topic. Regenerating for balance.",
			details: { maxTopicShare: Number(maxTopicShare.toFixed(2)) },
		};
	}

	if (input.skipMissingVisualGate !== true) {
		const missingVisualGate = gateStemReferencesMissingVisual(questions);
		if (!missingVisualGate.ok) return missingVisualGate;
	}

	const labelMismatchGate = gateVisualLabelsConsistentWithStem(questions);
	if (!labelMismatchGate.ok) return labelMismatchGate;

	const leakGate = gateVisualLeaksAnswer(questions);
	if (!leakGate.ok) return leakGate;

	if (input.chunkAlignment) {
		const chunkGate = gateChunkAlignmentLexical(
			questions,
			input.chunkAlignment.corpusByTopicId,
			input.chunkAlignment.contextQuality,
		);
		if (!chunkGate.ok) return chunkGate;
	}

	return { ok: true };
}

/**
 * Stems whose wording implies a diagram/table/figure/passage/etc. (see
 * `stem-visual-hints.ts`) but have no `visual` envelope — same heuristic as
 * `pnpm eval:visuals` criteria 1 and 4. Intentionally avoids bare “below/above”
 * MCQ boilerplate so gates behave consistently across subjects.
 */
function gateStemReferencesMissingVisual(
	questions: PracticeGenerationOutput["questions"],
): PracticeQualityGateResult {
	const failedIndexes: number[] = [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (q && stemNeedsVisualHint(q.question_text) && !q.visual) failedIndexes.push(i);
	}
	if (failedIndexes.length === 0) return { ok: true };
	return {
		ok: false,
		code: "stem_references_missing_visual",
		message: `${failedIndexes.length} question(s) reference a visual that wasn't emitted. Regenerating with self-contained stems.`,
		details: { offenderCount: failedIndexes.length, failedIndexes },
	};
}

/**
 * Single-letter labels used in MCQ stems ("at point B", "force F acts on…")
 * MUST appear in the visual spec — usually as a primitive's `label` or in
 * an axis/marker name. We do a coarse string check by stringifying the spec
 * and looking for `"…label": "X"` patterns. Designed to over-fire rather
 * than miss; false positives are bounced and the model re-emits.
 *
 * Skip cases:
 *   - `q.visual` is null (no visual to compare against).
 *   - The stem doesn't carry a single-letter label A-D.
 *   - The stem reuses A-D as MCQ option keys (we mask those out before
 *     extracting labels).
 */
function gateVisualLabelsConsistentWithStem(
	questions: PracticeGenerationOutput["questions"],
): PracticeQualityGateResult {
	const failedIndexes: number[] = [];
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q?.visual) continue;
		const labels = extractStemLabels(q.question_text);
		if (labels.length === 0) continue;
		const specStr = JSON.stringify(q.visual.spec);
		if (labels.some((label) => !specStr.includes(`"${label}`))) failedIndexes.push(i);
	}
	if (failedIndexes.length === 0) return { ok: true };
	return {
		ok: false,
		code: "visual_label_mismatch",
		message: `${failedIndexes.length} question(s) have stem labels missing from the visual spec. Regenerating with consistent labels.`,
		details: { offenderCount: failedIndexes.length, failedIndexes },
	};
}

/**
 * Extract single-letter labels (A–Z) that act like point/object names in a
 * stem. We strip MCQ-option markers ("(A)", "A. ", "A)") first because
 * those are structural and never appear in the visual spec, then look for:
 *   - Isolated capital letters surrounded by word boundaries.
 *   - Concatenated 2-letter all-caps (segment/edge naming: AB, BC, …).
 *     Longer sequences (NCERT, ATP) are skipped to avoid acronym noise.
 */
function extractStemLabels(stem: string): string[] {
	const masked = stem
		.replace(/\([A-D]\)/g, "")
		.replace(/\b[A-D][).:\-]\s/g, "")
		.replace(/\boption\s+[A-D]\b/gi, "");
	const set = new Set<string>();
	for (const match of masked.match(/\b[A-Z]\b/g) ?? []) set.add(match);
	for (const pair of masked.match(/\b[A-Z]{2}\b/g) ?? []) {
		for (const ch of pair) set.add(ch);
	}
	// "I" is the personal pronoun; "A" is an article; both produce noise.
	set.delete("I");
	set.delete("A");
	return Array.from(set);
}

/** Build lowercase corpus text per topic_id from topic_grounding rows. */
export function buildTopicCorpusMap(
	topicGrounding: ReadonlyArray<{
		topic_id: string;
		content_chunks: ReadonlyArray<{ text: string }>;
		exercise_chunks: ReadonlyArray<{ text: string }>;
		question_bank_chunks?: ReadonlyArray<{ text: string }>;
	}>,
): Map<string, string> {
	const m = new Map<string, string>();
	for (const t of topicGrounding) {
		const parts = [...t.content_chunks, ...t.exercise_chunks, ...(t.question_bank_chunks ?? [])]
			.map((c) => c.text)
			.join("\n");
		m.set(t.topic_id, parts);
	}
	return m;
}

export const __test = {
	extractStemLabels,
	gateStemReferencesMissingVisual,
	gateVisualLabelsConsistentWithStem,
	extractSignificantStemTokens,
	gateVisualLeaksAnswer,
	gateChunkAlignmentLexical,
};
