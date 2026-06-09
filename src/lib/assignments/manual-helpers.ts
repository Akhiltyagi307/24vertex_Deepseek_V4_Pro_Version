import type { ManualQuestionDraft, ManualQuestionType } from "@/components/teacher/manual/manual-question-editor";

import { manualAssignmentConfigSchema, type ManualAssignmentConfig, type ManualQuestionInput } from "./manual-schemas";

/** Build the stored manual config from authored questions (derives topic_ids + count). */
export function deriveManualConfig(input: {
	subjectId: string;
	difficulty: "easy" | "medium" | "hard";
	timeLimitSeconds: number;
	questions: ManualQuestionInput[];
}): ManualAssignmentConfig {
	const topicIds = [...new Set(input.questions.map((q) => q.topic_id))];
	return manualAssignmentConfigSchema.parse({
		v: 1,
		kind: "practice_test",
		authoring_mode: "manual",
		subject_id: input.subjectId,
		topic_ids: topicIds,
		difficulty: input.difficulty,
		question_count: input.questions.length,
		time_limit_seconds: input.timeLimitSeconds,
	});
}

/** Row shape for inserting authored questions into assignment_questions. */
export type ManualQuestionDbRow = {
	questionNumber: number;
	topicId: string;
	questionType: ManualQuestionInput["question_type"];
	questionText: string;
	options: unknown | null;
	answerKey: unknown;
	difficultyLevel: string;
};

/** Map validated questions to DB rows (1-based numbering, MCQ-only options). */
export function manualQuestionsToDbRows(questions: ManualQuestionInput[]): ManualQuestionDbRow[] {
	return questions.map((q, index) => ({
		questionNumber: index + 1,
		topicId: q.topic_id,
		questionType: q.question_type,
		questionText: q.question_text,
		options: q.question_type === "multiple_choice" ? q.options : null,
		answerKey: q.answer_key,
		difficultyLevel: q.difficulty_level,
	}));
}

export const NOT_STARTED_LIFECYCLES = ["pending_materialize", "ready", "failed_generation"] as const;

/** Given per-lifecycle counts, split into not-started (editable) vs frozen. */
export function summarizeNotStartedImpact(counts: Record<string, number>): {
	appliedToNotStarted: number;
	skippedAlreadyStarted: number;
} {
	let applied = 0;
	let skipped = 0;
	for (const [status, n] of Object.entries(counts)) {
		if ((NOT_STARTED_LIFECYCLES as readonly string[]).includes(status)) applied += n;
		else skipped += n;
	}
	return { appliedToNotStarted: applied, skippedAlreadyStarted: skipped };
}

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function splitLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/**
 * Map a loose editor draft to the strict server payload. Returns a plain object;
 * the caller validates it with `manualQuestionInputSchema` (server side), so this
 * mapper stays pure and dependency-light.
 */
export function manualDraftToQuestionInput(draft: ManualQuestionDraft): ManualQuestionInput {
	const base = {
		topic_id: draft.topicId,
		question_text: draft.questionText.trim(),
		difficulty_level: draft.difficultyLevel,
	};

	switch (draft.questionType) {
		case "multiple_choice": {
			// Compact out blank options so the letters stay contiguous (A, B, …) —
			// the schema requires A and B with no gaps — and remap the correct letter
			// to follow its option after compaction.
			const filled = draft.options
				.map((opt, i) => ({ text: opt.trim(), isCorrect: i === draft.correctIndex }))
				.filter((opt) => opt.text.length > 0);
			const options: Record<string, string> = {};
			let correctLetter: (typeof LETTERS)[number] = LETTERS[0];
			filled.forEach((opt, i) => {
				options[LETTERS[i]] = opt.text;
				if (opt.isCorrect) correctLetter = LETTERS[i];
			});
			return {
				...base,
				question_type: "multiple_choice",
				options: options as never,
				answer_key: { correct_answer: correctLetter as never },
			} as ManualQuestionInput;
		}
		case "fill_in_blank": {
			const variants = splitLines(draft.acceptableVariants);
			return {
				...base,
				question_type: "fill_in_blank",
				answer_key: {
					correct_answer: draft.correctAnswer.trim(),
					...(variants.length ? { acceptable_variants: variants } : {}),
				},
			} as ManualQuestionInput;
		}
		case "numerical": {
			const tolerance = draft.tolerance.trim() === "" ? undefined : Number(draft.tolerance);
			return {
				...base,
				question_type: "numerical",
				answer_key: {
					correct_answer: draft.correctAnswer.trim(),
					...(tolerance != null && Number.isFinite(tolerance) ? { tolerance } : {}),
					...(draft.units.trim() ? { units: draft.units.trim() } : {}),
				},
			} as ManualQuestionInput;
		}
		case "short_answer":
		case "long_answer": {
			const markingPoints = splitLines(draft.markingPoints);
			return {
				...base,
				question_type: draft.questionType,
				answer_key: {
					...(draft.modelAnswer.trim() ? { model_answer: draft.modelAnswer.trim() } : {}),
					...(markingPoints.length ? { marking_points: markingPoints } : {}),
				},
			} as ManualQuestionInput;
		}
		default: {
			const _exhaustive: never = draft.questionType;
			throw new Error(`Unsupported question type: ${String(_exhaustive)}`);
		}
	}
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

/** Shape of a stored authored question (as returned by getManualAssignmentForEdit). */
export type StoredManualQuestion = {
	questionType: string;
	topicId: string;
	questionText: string;
	options: unknown;
	answerKey: unknown;
	difficultyLevel: string;
};

/**
 * Inverse of {@link manualDraftToQuestionInput}: rebuild a loose editor draft from a
 * stored authored question so the builder can load it for edit / draft resume.
 * Reads jsonb defensively. Builds the draft literal directly (no client-editor import).
 */
export function storedQuestionToDraft(stored: StoredManualQuestion, id: string): ManualQuestionDraft {
	const allTypes: ManualQuestionType[] = [
		"multiple_choice",
		"fill_in_blank",
		"numerical",
		"short_answer",
		"long_answer",
	];
	const questionType = allTypes.includes(stored.questionType as ManualQuestionType)
		? (stored.questionType as ManualQuestionType)
		: "short_answer";
	const difficultyLevel: "easy" | "medium" | "hard" =
		stored.difficultyLevel === "easy" || stored.difficultyLevel === "hard" ? stored.difficultyLevel : "medium";
	const ak = (stored.answerKey ?? {}) as Record<string, unknown>;

	const draft: ManualQuestionDraft = {
		id,
		questionType,
		topicId: stored.topicId,
		questionText: stored.questionText,
		difficultyLevel,
		options: ["", ""],
		correctIndex: 0,
		correctAnswer: "",
		acceptableVariants: "",
		tolerance: "",
		units: "",
		modelAnswer: "",
		markingPoints: "",
	};

	if (questionType === "multiple_choice") {
		const opts = (stored.options ?? {}) as Record<string, unknown>;
		const letters = LETTERS as readonly string[];
		const arr = letters.map((l) => (typeof opts[l] === "string" ? (opts[l] as string) : ""));
		let lastNonEmpty = -1;
		arr.forEach((v, i) => {
			if (v.trim()) lastNonEmpty = i;
		});
		const sliced = arr.slice(0, Math.max(2, lastNonEmpty + 1));
		draft.options = sliced.length >= 2 ? sliced : ["", ""];
		const correct = typeof ak.correct_answer === "string" ? ak.correct_answer : "A";
		const ci = letters.indexOf(correct);
		draft.correctIndex = ci >= 0 && ci < draft.options.length ? ci : 0;
	} else if (questionType === "fill_in_blank") {
		draft.correctAnswer = typeof ak.correct_answer === "string" ? ak.correct_answer : "";
		draft.acceptableVariants = asStringArray(ak.acceptable_variants).join("\n");
	} else if (questionType === "numerical") {
		draft.correctAnswer =
			typeof ak.correct_answer === "string"
				? ak.correct_answer
				: typeof ak.correct_answer === "number"
					? String(ak.correct_answer)
					: "";
		draft.tolerance = typeof ak.tolerance === "number" ? String(ak.tolerance) : "";
		draft.units = typeof ak.units === "string" ? ak.units : "";
	} else {
		draft.modelAnswer = typeof ak.model_answer === "string" ? ak.model_answer : "";
		draft.markingPoints = asStringArray(ak.marking_points).join("\n");
	}

	return draft;
}

export type { ManualQuestionType };
