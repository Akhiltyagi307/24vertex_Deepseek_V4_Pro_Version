import type { PracticeGenerationOutput } from "./generation-schema";

export type PracticeQualityGateFailureCode =
	| "near_duplicate_stems"
	| "topic_concentration"
	| "stem_references_missing_visual"
	| "visual_label_mismatch";

export type PracticeQualityGateResult =
	| { ok: true }
	| { ok: false; code: PracticeQualityGateFailureCode; message: string; details?: Record<string, number | string> };

const NEAR_DUPLICATE_SIMILARITY_THRESHOLD = 0.9;
const MAX_TOPIC_SHARE = 0.65;

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

export function evaluatePracticeGenerationQuality(
	output: Pick<PracticeGenerationOutput, "questions">,
): PracticeQualityGateResult {
	const questions = output.questions;
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
	if (maxTopicShare > MAX_TOPIC_SHARE) {
		return {
			ok: false,
			code: "topic_concentration",
			message: "Generated questions are overly concentrated in one topic. Regenerating for balance.",
			details: { maxTopicShare: Number(maxTopicShare.toFixed(2)) },
		};
	}

	const missingVisualGate = gateStemReferencesMissingVisual(questions);
	if (!missingVisualGate.ok) return missingVisualGate;

	const labelMismatchGate = gateVisualLabelsConsistentWithStem(questions);
	if (!labelMismatchGate.ok) return labelMismatchGate;

	return { ok: true };
}

/**
 * Stems containing words like "the figure / diagram / graph / table / circuit
 * / structure / image / drawing" but with no `visual` envelope are almost
 * always orphaned references that the model promised but did not produce.
 * Bouncing them lets the retry policy re-emit either with a visual or with a
 * rewritten self-contained stem.
 *
 * Word boundaries on either side keep "the figure of speech" or "image
 * processing" out of the false-positive set; the article "the" before the
 * keyword is the load-bearing signal.
 */
const STEM_REQUIRES_VISUAL = /\bthe\s+(figure|diagram|graph|table|circuit|structure|image|drawing)\b/i;

function gateStemReferencesMissingVisual(
	questions: PracticeGenerationOutput["questions"],
): PracticeQualityGateResult {
	const offenders = questions.filter(
		(q) => STEM_REQUIRES_VISUAL.test(q.question_text) && !q.visual,
	);
	if (offenders.length === 0) return { ok: true };
	return {
		ok: false,
		code: "stem_references_missing_visual",
		message: `${offenders.length} question(s) reference a visual that wasn't emitted. Regenerating with self-contained stems.`,
		details: { offenderCount: offenders.length },
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
	const offenders = questions.filter((q) => {
		if (!q.visual) return false;
		const labels = extractStemLabels(q.question_text);
		if (labels.length === 0) return false;
		const specStr = JSON.stringify(q.visual.spec);
		// The label must appear inside a `"label": "X..."` quoted string. We do
		// a coarse `"X` substring check after a `: "` to keep false positives
		// down without inventing a tokenizer.
		return labels.some((label) => !specStr.includes(`"${label}`));
	});
	if (offenders.length === 0) return { ok: true };
	return {
		ok: false,
		code: "visual_label_mismatch",
		message: `${offenders.length} question(s) have stem labels missing from the visual spec. Regenerating with consistent labels.`,
		details: { offenderCount: offenders.length },
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

export const __test = { extractStemLabels, gateStemReferencesMissingVisual, gateVisualLabelsConsistentWithStem };
