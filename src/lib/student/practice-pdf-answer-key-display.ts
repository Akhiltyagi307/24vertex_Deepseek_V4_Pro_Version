import { normalizeKatexMath } from "@/lib/practice/katex-math-normalize";
import { practiceAnswerKeySchema } from "@/lib/practice/generation-schema";

export type FormatGenerationAnswerParams = {
	questionType: string;
	options: Record<string, string> | null | undefined;
	answerKeyJson: unknown;
};

/**
 * Formats generation-time `answer_key` (+ MCQ `options`) for the practice PDF.
 * Uses the same schema as practice generation; falls back to raw JSON.stringify on parse failure.
 */
export function formatGenerationAnswerForPdf(params: FormatGenerationAnswerParams): string {
	const { questionType, options, answerKeyJson } = params;
	const parsed = practiceAnswerKeySchema.safeParse(answerKeyJson);
	if (!parsed.success) {
		if (answerKeyJson != null && typeof answerKeyJson === "object") {
			return JSON.stringify(answerKeyJson, null, 2).slice(0, 8000);
		}
		return String(answerKeyJson ?? "—");
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
