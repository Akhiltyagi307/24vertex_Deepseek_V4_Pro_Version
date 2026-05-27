import type { PracticeGenerationOutput } from "./generation-schema";
import { normalizeKatexMath } from "./katex-math-normalize";

const LETTER_ONLY = /^[A-D]$/i;
const LETTER_WITH_DECORATION = /^(?:option\s*)?([A-D])[\).:\-]?$/i;
const DEFAULT_ESTIMATED_TIME_SECONDS = 60;

type PracticeQuestion = PracticeGenerationOutput["questions"][number];

function normalizeEstimatedTime(seconds: number): number {
	return Number.isFinite(seconds) && seconds > 0 ?
			Math.max(1, Math.round(seconds))
		:	DEFAULT_ESTIMATED_TIME_SECONDS;
}

function normalizeMcqCorrectAnswer(
	correctAnswer: string,
	options: Record<string, string> | null,
): string {
	const trimmed = correctAnswer.trim();
	if (!trimmed) return correctAnswer;
	if (LETTER_ONLY.test(trimmed)) return trimmed.toUpperCase();

	const decorated = trimmed.match(LETTER_WITH_DECORATION);
	if (decorated?.[1]) return decorated[1].toUpperCase();

	if (!options) return correctAnswer;
	const normalizedAnswer = trimmed.toLowerCase();
	let matchedLetter: string | null = null;
	for (const [letter, value] of Object.entries(options)) {
		if (value.trim().toLowerCase() !== normalizedAnswer) continue;
		if (matchedLetter) return correctAnswer; // ambiguous match, keep original
		matchedLetter = letter.trim().toUpperCase();
	}
	return matchedLetter && LETTER_ONLY.test(matchedLetter) ? matchedLetter : correctAnswer;
}

function normalizeOptionsKatex(
	options: Record<string, string> | null,
): Record<string, string> | null {
	if (!options) return options;
	const out: Record<string, string> = {};
	for (const [letter, value] of Object.entries(options)) {
		out[letter] = normalizeKatexMath(value);
	}
	return out;
}

function fixQuestion(question: PracticeQuestion, index: number): PracticeQuestion {
	const isMcq = question.question_type === "multiple_choice";
	const normalizedOptions = isMcq ? normalizeOptionsKatex(question.options) : null;
	const normalizedCorrectAnswer =
		isMcq ?
			normalizeMcqCorrectAnswer(question.answer_key.correct_answer, normalizedOptions)
		:	question.answer_key.correct_answer.trim();

	// Normalize Unicode-math (²³ ± √ ÷ × · etc.) to `$...$`-wrapped KaTeX
	// across every visible text field. The LLM is instructed to use `$...$`
	// directly (see practice-generation-batch-system-prompt:MATH_TEXT_FORMATTING),
	// but observed behaviour shows it backslides into Unicode for ~60% of
	// questions — especially in explanations. This pass cleans up.
	const normalizedExplanation = normalizeKatexMath(question.answer_key.explanation);
	const normalizedCommonMistakes = (question.answer_key.common_mistakes ?? []).map((m) =>
		normalizeKatexMath(m),
	);
	const normalizedRelatedConcept =
		question.answer_key.related_concept != null
			? normalizeKatexMath(question.answer_key.related_concept)
			: question.answer_key.related_concept;
	const normalizedDistractorRationale = isMcq
		? (() => {
				const dr = question.answer_key.distractor_rationale;
				if (!dr) return dr;
				const out: Record<string, string> = {};
				for (const [letter, value] of Object.entries(dr)) {
					out[letter] = normalizeKatexMath(value);
				}
				return out as typeof question.answer_key.distractor_rationale;
			})()
		: question.answer_key.distractor_rationale;
	const normalizedQuestionText = normalizeKatexMath(question.question_text);

	return {
		...question,
		question_number: index + 1,
		topic_id: question.topic_id.trim(),
		question_text: normalizedQuestionText,
		options: normalizedOptions,
		estimated_time_seconds: normalizeEstimatedTime(question.estimated_time_seconds),
		answer_key: {
			...question.answer_key,
			correct_answer: normalizedCorrectAnswer,
			explanation: normalizedExplanation,
			common_mistakes: normalizedCommonMistakes,
			related_concept: normalizedRelatedConcept,
			distractor_rationale: normalizedDistractorRationale,
		},
	};
}

/**
 * Deterministic cleanup pass before schema/business validation.
 *
 * This is intentionally conservative and model-free:
 * - re-sequences question_number
 * - forces non-MCQ options to null
 * - normalizes obvious MCQ answer-key formatting
 * - clamps invalid estimated_time_seconds
 */
export function applyDeterministicPracticeAutofix(
	raw: PracticeGenerationOutput,
): PracticeGenerationOutput {
	return {
		...raw,
		questions: raw.questions.map((q, idx) => fixQuestion(q, idx)),
	};
}
