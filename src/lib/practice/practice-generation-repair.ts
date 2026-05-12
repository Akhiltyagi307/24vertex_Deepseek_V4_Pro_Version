import type { PracticeQuestionTypeCounts } from "./constants";
import type {
	PracticeRoundRobinFlatIndexMapEntry,
	PracticeValidationRepairDiagnostics,
} from "./generation-schema";
import type {
	PracticeQualityGateDetails,
	PracticeQualityGateFailureCode,
} from "./practice-generation-quality-gates";

const REPAIR_USER_BODY_MAX_CHARS = 380_000;
const REPAIR_BASE_USER_APPEND_MAX_CHARS = 120_000;

export type PracticeGenerationRepairReason =
	| {
			kind: "validation";
			message: string;
			diagnostics: PracticeValidationRepairDiagnostics;
	  }
	| {
			kind: "quality";
			code: PracticeQualityGateFailureCode;
			message: string;
			/** Flattened MCQ→fill→short→long round-robin order; empty ⇒ gate-wide edits */
			failedIndexes: number[];
			gateDetails?: PracticeQualityGateDetails;
			preferredVisualKinds?: readonly string[];
	  }
	| {
			kind: "dedup";
			message: string;
			failedIndexes: number[];
	  };

/**
 * System prompt for the targeted repair pass after the main generator output
 * fails {@link validateAndStripGeneration}. Same Zod schema as initial
 * generation; the repair model returns the FULL payload (no diff) but is
 * told to change as little as possible.
 *
 * Strict JSON-schema mode for repair is OFF by default
 * (`PRACTICE_STRICT_JSON_SCHEMA_REPAIR`) — the strict path historically
 * caused the model to regenerate aggressively when we wanted a minimal
 * patch. The post-pass validator is the source of truth.
 */
export function buildPracticeGenerationRepairSystemPrompt(): string {
	return `You repair a practice test JSON object (\`questions_by_type\` + \`generation_metadata\`) produced by our generator.

Read the structured blocks in the **user message** before editing:
- **REPAIR_KIND** tells you VALIDATION vs QUALITY vs DEDUP.
- **VALIDATION**: use **VALIDATION_REPAIR_CONTEXT** (JSON): \`failureCode\`, \`expected\` vs \`observed\`, \`targets\` with \`flattenedIndex\` / \`bucket\` / \`slotInBucket\`, plus \`globalHint\`.
- **FLATTEN_INDEX_MAP**: each row maps **flattenedIndex** (0-based) to exactly one (\`questions_by_type\` bucket name, slotInBucket inside that bucket’s array). The generator flattens by **round-robin**: each round emits one MCQ slot (if remaining), then one fill-in-blank slot, etc., in MCQ→fill→short→long order. Use bucket+slot first for surgical edits when given.
- **QUALITY**: \`QUALITY_GATE\`, human \`QUALITY_DETAILS\`, **QUALITY_GATE_DETAILS_JSON** when present (\`failedIndexes\` etc.), optional **PREFERRED_VISUAL_KINDS**.
- **DEDUP**: **FAILED_INDEXES** lists flattenedIndices to diverge vs the student’s past questions.

Minimal-patch rules:
- Preserve ALL fields byte-for-byte except what must move to satisfy the failure.
- If targets list a (\`bucket\`, \`slotInBucket\`) / \`flattenedIndex\`, prefer fixing ONLY those rows first.
- For \`failureCode === time_budget\`, adjust ONLY \`estimated_time_seconds\` across questions until the SUM lies in [\`TIME_SUM_MIN\`, \`TIME_SUM_MAX\`].
- For \`failureCode === type_mix_mismatch\`, move or rewrite **entire rows** across \`questions_by_type\` arrays so BOTH per-bucket lengths and per-type totals match REQUIRED_BUCKET_LENGTHS / requiredTypeCounts.
- For VALIDATION hints that match prose in VALIDATION_FAILURE, treat VALIDATION_REPAIR_CONTEXT as authoritative for indices and numeric expectations.

Hard contract:
- SAME top-level shape; SAME array lengths in each bucket as REQUIRED_BUCKET_LENGTHS.
- MCQ rows: exactly \`options\` keys A,B,C,D; letter answer only.
- Non-MCQ buckets: \`options: null\`.
- Topic UUIDs MUST be verbatim from ALLOWED_TOPIC_IDS JSON.
- Output raw JSON only (no fences, no commentary).

Quality summaries:
- FAILED_INDEXES (when non-empty): edit only those flattened slots first.
- Gates \`stem_references_missing_visual\`, \`visual_label_mismatch\`, \`visual_leaks_answer\`, \`chunk_alignment_weak\`, \`near_duplicate_stems\`, \`topic_concentration\` — follow QUALITY_GATE + QUALITY_HINT + gate JSON + GENERATION_CONTEXT_USER_MESSAGE.

Dedup: rewrite flagged stems meaningfully without breaking schema or pedagogical correctness.`;
}

function qualityGateRepairHint(code: PracticeQualityGateFailureCode): string {
	switch (code) {
		case "near_duplicate_stems":
			return "Diversify wording across the closest pairs — keep syllabus alignment.";
		case "topic_concentration":
			return "Spread questions across ALLOWED_TOPIC_IDS; change topic_id where the stem still fits.";
		case "stem_references_missing_visual":
			return "Match figure/table/passage wording to visual or flatten the stem.";
		case "visual_label_mismatch":
			return "Every stem letter label must appear on the referenced primitive/axis in visual.spec.";
		case "visual_leaks_answer":
			return "Caption/altText: layout/description only — no keyed answer or option text.";
		case "chunk_alignment_weak":
			return "Reuse terms and scenario patterns from grounding text in GENERATION_CONTEXT_USER_MESSAGE.";
		default: {
			const _exhaustive: never = code;
			void _exhaustive;
			return "Fix minimally while preserving valid schema.";
		}
	}
}

export function normalizeQualityFailedIndexes(details: PracticeQualityGateDetails | undefined): number[] {
	const raw = details?.failedIndexes;
	if (!Array.isArray(raw)) return [];
	return raw.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

export function failedIndexesFromQualityGate(gate: {
	ok: false;
	code: PracticeQualityGateFailureCode;
	details?: PracticeQualityGateDetails;
}): number[] {
	return normalizeQualityFailedIndexes(gate.details);
}

/** Re-export for callers that depended on repair-local typings. */
export type { PracticeQualityGateDetails } from "./practice-generation-quality-gates";

export function buildPracticeGenerationRepairUserPrompt(args: {
	reason: PracticeGenerationRepairReason;
	timeLimitSeconds: number;
	timeSumMin: number;
	timeSumMax: number;
	allowedTopicIds: string[];
	questionTypeCounts: PracticeQuestionTypeCounts;
	failedGroupedJson: string;
	/** Maps flattened indices to bucket + slot — required for VALIDATION/DEDUP/QUALITY(with FAILED_INDEXES) */
	flatIndexMap: PracticeRoundRobinFlatIndexMapEntry[];
	baseUserPrompt?: string;
	/** Optional compact context containing only failed slots and their evidence slices. */
	targetedContextJson?: string;
	/** Full original generation context is expensive; keep OFF unless explicitly enabled. */
	includeBaseUserPrompt?: boolean;
}): string {
	let body = args.failedGroupedJson;
	if (body.length > REPAIR_USER_BODY_MAX_CHARS) {
		body =
			body.slice(0, REPAIR_USER_BODY_MAX_CHARS) +
			"\n...(truncated for size; use REPAIR_PAYLOAD fields and ALLOWED_TOPIC_IDS.)";
	}
	const lines: string[] = [];

	if (args.reason.kind === "validation") {
		const r = args.reason;
		const d = r.diagnostics;
		lines.push(`REPAIR_KIND: VALIDATION`);
		lines.push(`VALIDATION_FAILURE: ${r.message}`);
		lines.push(
			"VALIDATION_REPAIR_CONTEXT:",
			JSON.stringify({
				failureCode: d.failureCode,
				expected: d.expected,
				groupedBucketLengths: d.groupedBucketLengths,
				observed: d.observed,
				targets: d.targets,
				globalHint: d.globalHint,
			}),
		);
	} else if (args.reason.kind === "dedup") {
		const r = args.reason;
		lines.push(`REPAIR_KIND: DEDUP`);
		lines.push(`DEDUP_FAILURE: ${r.message}`);
		lines.push(`FAILED_INDEXES: ${JSON.stringify(r.failedIndexes)}`);
	} else {
		const q = args.reason;
		lines.push(`REPAIR_KIND: QUALITY`);
		lines.push(`QUALITY_GATE: ${q.code}`);
		lines.push(`QUALITY_DETAILS: ${q.message}`);
		lines.push(`QUALITY_HINT: ${qualityGateRepairHint(q.code)}`);
		lines.push(`FAILED_INDEXES: ${JSON.stringify(q.failedIndexes)}`);
		if (q.gateDetails != null && Object.keys(q.gateDetails).length > 0) {
			lines.push("QUALITY_GATE_DETAILS_JSON:", JSON.stringify(q.gateDetails));
		}
		if (q.preferredVisualKinds != null && q.preferredVisualKinds.length > 0) {
			lines.push(
				"PREFERRED_VISUAL_KINDS (prefer null visual or kinds in this list for non-spoiling fixes):",
				JSON.stringify([...q.preferredVisualKinds]),
			);
		}
	}

	const flatIndexMap = args.flatIndexMap ?? [];

	if (flatIndexMap.length > 0) {
		lines.push(
			"FLATTEN_INDEX_MAP (flattened MCQ→fill→short→long round-robin: index → bucket + slot within that bucket array):",
			JSON.stringify(flatIndexMap),
		);
	}

	lines.push(
		"",
		"HARD_LIMITS_AND_IDS:",
		`TIME_LIMIT_SECONDS: ${args.timeLimitSeconds}`,
		`TIME_SUM_MIN: ${args.timeSumMin}`,
		`TIME_SUM_MAX: ${args.timeSumMax}`,
		`ALLOWED_TOPIC_IDS:`,
		JSON.stringify(args.allowedTopicIds),
		`REQUIRED_BUCKET_LENGTHS (questions_by_type.*.length):`,
		JSON.stringify(args.questionTypeCounts),
		`FAILED_OUTPUT_JSON:`,
		body,
	);

	if (args.targetedContextJson && args.targetedContextJson.trim()) {
		let targeted = args.targetedContextJson;
		if (targeted.length > REPAIR_BASE_USER_APPEND_MAX_CHARS) {
			targeted = targeted.slice(0, REPAIR_BASE_USER_APPEND_MAX_CHARS) + "\n...(truncated)";
		}
		lines.push("", "TARGETED_CONTEXT_JSON:", targeted);
	}

	if (
		args.includeBaseUserPrompt === true &&
		args.baseUserPrompt != null &&
		args.baseUserPrompt.length > 0 &&
		args.reason.kind === "quality"
	) {
		let ctx = args.baseUserPrompt;
		if (ctx.length > REPAIR_BASE_USER_APPEND_MAX_CHARS) {
			ctx = ctx.slice(0, REPAIR_BASE_USER_APPEND_MAX_CHARS) + "\n...(truncated)";
		}
		if (ctx) {
			lines.push("", "GENERATION_CONTEXT_USER_MESSAGE:");
			lines.push(ctx);
		}
	}

	return lines.join("\n");
}
