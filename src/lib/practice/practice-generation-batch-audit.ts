import type { GeneratedPracticeQuestion } from "./generation-schema";

/**
 * Post-merge invariant audit for the V2 parallel-batched generation. Runs
 * pure TS checks across the full merged test (no LLM). Surfaces issues the
 * downstream Flash editor pass (or a targeted repair) can address.
 *
 * The audit is INFORMATIONAL — it never blocks the pipeline. The pipeline
 * decides whether to invoke the editor pass based on issue severity.
 */

/**
 * Pre-audit normaliser. Cleans deterministic writer-side artefacts that we
 * shouldn't bother the LLM editor with:
 *
 * - MCQ `distractor_rationale` with the ALL-CAPS "CORRECT" tag on more than
 *   one option. We trust `answer_key.correct_answer` as the source of truth
 *   (the question text + options were keyed by the writer against it) and
 *   strip the bogus "CORRECT" token from the off-letter rationale entries,
 *   replacing it with a neutral archetype tag based on what's already there
 *   or "PARTIAL-KNOWLEDGE" as a safe fallback. Returns the count of fixes.
 *
 * Mutates `questions` in place. Idempotent.
 */
export function normalizePracticeGenerationArtifacts(
	questions: GeneratedPracticeQuestion[],
): { mcq_duplicate_correct_label_fixes: number } {
	let mcqDuplicateCorrectLabelFixes = 0;
	const ALL_CAPS_CORRECT = /\bCORRECT\b/;
	const ARCHETYPE_TAGS = ["COMMON-ERROR", "PARTIAL-KNOWLEDGE", "SURFACE-PLAUSIBILITY"] as const;

	for (const q of questions) {
		if (q.question_type !== "multiple_choice") continue;
		const dr = q.answer_key?.distractor_rationale as
			| { A?: string; B?: string; C?: string; D?: string }
			| undefined;
		if (!dr) continue;
		const keyedLetter = (q.answer_key?.correct_answer ?? "").trim().toUpperCase();
		if (!["A", "B", "C", "D"].includes(keyedLetter)) continue;

		const letters: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
		const lettersWithCorrectLabel = letters.filter(
			(L) => typeof dr[L] === "string" && ALL_CAPS_CORRECT.test(dr[L]!),
		);
		if (lettersWithCorrectLabel.length <= 1) continue;

		// Track which archetype tags are already used so we don't repeat them.
		const usedArchetypes = new Set<string>();
		for (const L of letters) {
			const v = dr[L];
			if (!v || L === keyedLetter) continue;
			for (const tag of ARCHETYPE_TAGS) {
				if (v.includes(tag)) usedArchetypes.add(tag);
			}
		}

		// Strip the ALL-CAPS "CORRECT" token from every off-letter entry and,
		// when the entry has no archetype tag at all, prepend a fallback.
		for (const L of letters) {
			if (L === keyedLetter) continue;
			const original = dr[L];
			if (typeof original !== "string") continue;
			if (!ALL_CAPS_CORRECT.test(original)) continue;
			// Replace exact ALL-CAPS "CORRECT" boundary token only — leaves
			// "correctly" etc. alone.
			let next = original.replace(/\bCORRECT\b/g, "").replace(/^[\s—-]+/, "").trim();
			const hasArchetype = ARCHETYPE_TAGS.some((tag) => next.includes(tag));
			if (!hasArchetype) {
				// Pick the first archetype not already used on another off-letter.
				const fallback =
					ARCHETYPE_TAGS.find((tag) => !usedArchetypes.has(tag)) ?? "PARTIAL-KNOWLEDGE";
				usedArchetypes.add(fallback);
				next = `${fallback} — ${next}`.trim();
			}
			dr[L] = next;
		}
		mcqDuplicateCorrectLabelFixes++;
	}
	return { mcq_duplicate_correct_label_fixes: mcqDuplicateCorrectLabelFixes };
}

export type PracticeBatchAuditIssue =
	| {
			kind: "letter_imbalance";
			distribution: Record<"A" | "B" | "C" | "D", number>;
			worst_letter: "A" | "B" | "C" | "D";
			worst_share: number;
	  }
	| {
			kind: "bloom_clustering";
			unique_verbs: number;
			dominant_verb: string;
			dominant_share: number;
	  }
	| {
			kind: "time_sum_out_of_band";
			actual: number;
			min: number;
			max: number;
	  }
	| {
			kind: "near_duplicate_stem";
			indexes: [number, number];
			jaccard: number;
	  }
	| {
			kind: "difficulty_ramp_broken";
			out_of_order_pairs: Array<[number, number]>;
	  };

export type PracticeBatchAuditResult = {
	ok: boolean;
	issues: PracticeBatchAuditIssue[];
	/** Compact summary for telemetry / logs. */
	summary: {
		question_count: number;
		mcq_count: number;
		letter_distribution: Record<"A" | "B" | "C" | "D", number>;
		bloom_verbs_unique: number;
		time_sum: number;
		near_duplicate_count: number;
	};
};

const BLOOM_VERBS = new Set([
	"recall",
	"identify",
	"define",
	"state",
	"describe",
	"explain",
	"classify",
	"compare",
	"apply",
	"calculate",
	"compute",
	"derive",
	"analyze",
	"justify",
	"evaluate",
	"construct",
	"prove",
]);

function tokenSet(text: string): Set<string> {
	const tokens = text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 3);
	return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let inter = 0;
	for (const t of a) if (b.has(t)) inter++;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
}

function bloomVerbOf(q: GeneratedPracticeQuestion): string | null {
	const demand = q.cognitive_demand;
	if (typeof demand === "string") return demand.toLowerCase();
	// Fall back to checking the explanation for a leading Bloom verb.
	const first = q.question_text.trim().split(/[\s,.:;]/, 1)[0]?.toLowerCase();
	if (first && BLOOM_VERBS.has(first)) return first;
	return null;
}

/**
 * Audit a fully-merged test. `expectedTimeSumMin`/`Max` are the test-wide
 * bounds (from the user-message summary's time_sum_min / time_sum_max). The
 * duplicate-stem threshold and the letter-share cap are defaults the editor
 * pass can pick up.
 */
export function auditPracticeGeneration(args: {
	questions: GeneratedPracticeQuestion[];
	expectedTimeSumMin: number;
	expectedTimeSumMax: number;
	options?: {
		duplicateJaccardThreshold?: number; // default 0.7
		letterMaxShare?: number; // default 0.4
		bloomDominantMaxShare?: number; // default 0.5
		minUniqueBloomVerbs?: number; // default 3 (for tests >= 8 items)
	};
}): PracticeBatchAuditResult {
	const { questions, expectedTimeSumMin, expectedTimeSumMax } = args;
	const opts = {
		duplicateJaccardThreshold: 0.7,
		letterMaxShare: 0.4,
		bloomDominantMaxShare: 0.5,
		minUniqueBloomVerbs: 3,
		...args.options,
	};
	const issues: PracticeBatchAuditIssue[] = [];

	// --- letter distribution across MCQs ---
	const letterCounts: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
	let mcqCount = 0;
	for (const q of questions) {
		if (q.options && (q.question_type ?? "") === "multiple_choice") {
			const letter = q.answer_key?.correct_answer?.trim().toUpperCase();
			if (letter === "A" || letter === "B" || letter === "C" || letter === "D") {
				letterCounts[letter]++;
				mcqCount++;
			}
		}
	}
	if (mcqCount >= 4) {
		const worst = (Object.keys(letterCounts) as Array<"A" | "B" | "C" | "D">).reduce(
			(acc, k) => (letterCounts[k] > letterCounts[acc] ? k : acc),
			"A",
		);
		const worstShare = letterCounts[worst] / mcqCount;
		if (worstShare > opts.letterMaxShare) {
			issues.push({
				kind: "letter_imbalance",
				distribution: letterCounts,
				worst_letter: worst,
				worst_share: Number(worstShare.toFixed(2)),
			});
		}
	}

	// --- Bloom verb spread ---
	const verbCounts = new Map<string, number>();
	for (const q of questions) {
		const v = bloomVerbOf(q);
		if (v) verbCounts.set(v, (verbCounts.get(v) ?? 0) + 1);
	}
	const uniqueVerbs = verbCounts.size;
	if (questions.length >= 8 && uniqueVerbs < opts.minUniqueBloomVerbs) {
		const [dominantVerb, dominantCount] = [...verbCounts.entries()].reduce(
			(acc, cur) => (cur[1] > acc[1] ? cur : acc),
			["—", 0] as [string, number],
		);
		issues.push({
			kind: "bloom_clustering",
			unique_verbs: uniqueVerbs,
			dominant_verb: dominantVerb,
			dominant_share: Number((dominantCount / questions.length).toFixed(2)),
		});
	} else if (questions.length >= 4) {
		const [dominantVerb, dominantCount] = [...verbCounts.entries()].reduce(
			(acc, cur) => (cur[1] > acc[1] ? cur : acc),
			["—", 0] as [string, number],
		);
		const share = dominantCount / questions.length;
		if (share > opts.bloomDominantMaxShare) {
			issues.push({
				kind: "bloom_clustering",
				unique_verbs: uniqueVerbs,
				dominant_verb: dominantVerb,
				dominant_share: Number(share.toFixed(2)),
			});
		}
	}

	// --- time sum band ---
	const timeSum = questions.reduce((acc, q) => acc + (q.estimated_time_seconds || 0), 0);
	if (timeSum < expectedTimeSumMin || timeSum > expectedTimeSumMax) {
		issues.push({
			kind: "time_sum_out_of_band",
			actual: timeSum,
			min: expectedTimeSumMin,
			max: expectedTimeSumMax,
		});
	}

	// --- near-duplicate stems (pairwise Jaccard, O(n²) — fine for n ≤ 30) ---
	const tokenSets = questions.map((q) => tokenSet(q.question_text ?? ""));
	let duplicateCount = 0;
	for (let i = 0; i < questions.length; i++) {
		for (let j = i + 1; j < questions.length; j++) {
			const sim = jaccard(tokenSets[i]!, tokenSets[j]!);
			if (sim >= opts.duplicateJaccardThreshold) {
				issues.push({
					kind: "near_duplicate_stem",
					indexes: [i, j],
					jaccard: Number(sim.toFixed(2)),
				});
				duplicateCount++;
			}
		}
	}

	// --- difficulty ramp: easier slots earlier within each type bucket ---
	const order = { easy: 0, medium: 1, hard: 2 } as const;
	const byType = new Map<string, Array<{ idx: number; difficulty: keyof typeof order }>>();
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i]!;
		const t = q.question_type ?? "multiple_choice";
		const d = (q.difficulty_level ?? "medium") as keyof typeof order;
		if (!byType.has(t)) byType.set(t, []);
		byType.get(t)!.push({ idx: i, difficulty: d });
	}
	const outOfOrder: Array<[number, number]> = [];
	for (const list of byType.values()) {
		for (let i = 1; i < list.length; i++) {
			if (order[list[i]!.difficulty] < order[list[i - 1]!.difficulty]) {
				outOfOrder.push([list[i - 1]!.idx, list[i]!.idx]);
			}
		}
	}
	if (outOfOrder.length > 0) {
		issues.push({ kind: "difficulty_ramp_broken", out_of_order_pairs: outOfOrder });
	}

	return {
		ok: issues.length === 0,
		issues,
		summary: {
			question_count: questions.length,
			mcq_count: mcqCount,
			letter_distribution: letterCounts,
			bloom_verbs_unique: uniqueVerbs,
			time_sum: timeSum,
			near_duplicate_count: duplicateCount,
		},
	};
}
