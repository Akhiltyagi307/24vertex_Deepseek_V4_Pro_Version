import type { PracticeGenerationOutput } from "./generation-schema";

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

function fixQuestion(question: PracticeQuestion, index: number): PracticeQuestion {
	const isMcq = question.question_type === "multiple_choice";
	const normalizedOptions = isMcq ? question.options : null;
	const normalizedCorrectAnswer =
		isMcq ?
			normalizeMcqCorrectAnswer(question.answer_key.correct_answer, normalizedOptions)
		:	question.answer_key.correct_answer.trim();

	return {
		...question,
		question_number: index + 1,
		topic_id: question.topic_id.trim(),
		options: normalizedOptions,
		estimated_time_seconds: normalizeEstimatedTime(question.estimated_time_seconds),
		answer_key: {
			...question.answer_key,
			correct_answer: normalizedCorrectAnswer,
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
