import { normalizeKatexMath } from "@/lib/practice/katex-math-normalize";
import { practiceAnswerKeySchema } from "@/lib/practice/generation-schema";

export type FormatGenerationAnswerParams = {
	questionType: string;
	options: Record<string, string> | null | undefined;
	answerKeyJson: unknown;
};

function trimmedString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function trimmedStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
		: [];
}

/**
 * Lenient formatter for teacher-authored (manual) answer keys, which omit the
 * AI-only `explanation`/`common_mistakes`/`related_concept` fields and therefore
 * fail {@link practiceAnswerKeySchema}. Without this they rendered as a raw JSON
 * blob in the grading PDF / QnA review. Covers all manual question types.
 */
function formatManualAnswerKey(
	questionType: string,
	options: Record<string, string> | null | undefined,
	answerKeyJson: unknown,
): string {
	if (answerKeyJson == null || typeof answerKeyJson !== "object") {
		return String(answerKeyJson ?? "—");
	}
	const ak = answerKeyJson as Record<string, unknown>;
	const lines: string[] = [];
	const correct = trimmedString(ak.correct_answer);

	if (questionType === "multiple_choice" && correct) {
		const letter = correct.toUpperCase();
		const optText = options?.[letter] ?? options?.[letter.toLowerCase()];
		lines.push(optText ? `Correct answer: ${letter} — ${normalizeKatexMath(optText)}` : `Correct answer: ${letter}`);
	} else if (correct) {
		// fill_in_blank / numerical: a single textual/numeric answer.
		lines.push(`Correct answer: ${normalizeKatexMath(correct)}`);
		const units = trimmedString(ak.units);
		if (units) lines.push(`Units: ${units}`);
		if (typeof ak.tolerance === "number") lines.push(`Tolerance: ±${ak.tolerance}`);
		const variants = trimmedStringArray(ak.acceptable_variants);
		if (variants.length) lines.push(`Also accepted: ${variants.map((v) => normalizeKatexMath(v)).join(", ")}`);
	} else {
		// short_answer / long_answer: no single correct answer — show the rubric.
		const modelAnswer = trimmedString(ak.model_answer);
		if (modelAnswer) {
			lines.push("Model answer");
			lines.push(normalizeKatexMath(modelAnswer));
		}
		const markingPoints = trimmedStringArray(ak.marking_points);
		if (markingPoints.length) {
			if (lines.length) lines.push("");
			lines.push("Marking points");
			for (const point of markingPoints) lines.push(`• ${normalizeKatexMath(point)}`);
		}
	}

	const explanation = trimmedString(ak.explanation);
	if (explanation) {
		lines.push("");
		lines.push("Explanation");
		lines.push(normalizeKatexMath(explanation));
	}

	return lines.length > 0 ? lines.join("\n") : "—";
}

/**
 * Formats generation-time `answer_key` (+ MCQ `options`) for the practice PDF.
 * Uses the same schema as practice generation for AI-generated keys; teacher
 * authored (manual) keys take the lenient {@link formatManualAnswerKey} path.
 */
export function formatGenerationAnswerForPdf(params: FormatGenerationAnswerParams): string {
	const { questionType, options, answerKeyJson } = params;
	const parsed = practiceAnswerKeySchema.safeParse(answerKeyJson);
	if (!parsed.success) {
		return formatManualAnswerKey(questionType, options, answerKeyJson);
	}

	const key = parsed.data;
	const lines: string[] = [];

	const letter = key.correct_answer.trim().toUpperCase();
	const opts = options ?? null;

	if (questionType === "multiple_choice" && opts && letter) {
		const optText = opts[letter] ?? opts[letter.toLowerCase() as keyof typeof opts];
		if (optText) {
			lines.push(`Correct answer: ${letter} — ${normalizeKatexMath(optText)}`);
		} else {
			lines.push(`Correct answer: ${letter}`);
		}
	} else {
		lines.push(`Correct answer: ${normalizeKatexMath(key.correct_answer)}`);
	}

	if (key.explanation?.trim()) {
		lines.push("");
		lines.push("Explanation");
		lines.push(normalizeKatexMath(key.explanation.trim()));
	}

	if (key.common_mistakes?.length) {
		lines.push("");
		lines.push("Common mistakes");
		for (const m of key.common_mistakes) {
			if (m?.trim()) lines.push(`• ${normalizeKatexMath(m.trim())}`);
		}
	}

	if (key.related_concept?.trim()) {
		lines.push("");
		lines.push(`Related concept: ${normalizeKatexMath(key.related_concept.trim())}`);
	}

	return lines.filter(Boolean).join("\n");
}
