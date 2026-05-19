import type { QnaLogDetail, QnaLogPerformance } from "./types";

export type QnaLogVoice = "self" | "child";

export type VerdictTone = {
	chip: string;
	icon: string;
	surface: string;
	heading: string;
};

const TONE_CORRECT: VerdictTone = {
	chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	icon: "text-emerald-600 dark:text-emerald-300",
	surface: "border-emerald-500/40 bg-emerald-500/10",
	heading: "text-emerald-700 dark:text-emerald-200",
};

const TONE_PARTIAL: VerdictTone = {
	chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	icon: "text-amber-600 dark:text-amber-300",
	surface: "border-amber-500/40 bg-amber-500/10",
	heading: "text-amber-700 dark:text-amber-200",
};

const TONE_INCORRECT: VerdictTone = {
	chip: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
	icon: "text-rose-600 dark:text-rose-300",
	surface: "border-rose-500/40 bg-rose-500/10",
	heading: "text-rose-700 dark:text-rose-200",
};

const TONE_PENDING: VerdictTone = {
	chip: "border-border bg-muted text-muted-foreground",
	icon: "text-muted-foreground",
	surface: "border-border/70 bg-muted/40",
	heading: "text-foreground",
};

export function verdictTone(performance: QnaLogPerformance): VerdictTone {
	switch (performance) {
		case "correct":
			return TONE_CORRECT;
		case "partial":
			return TONE_PARTIAL;
		case "incorrect":
			return TONE_INCORRECT;
		default:
			return TONE_PENDING;
	}
}

export function verdictHeadline(performance: QnaLogPerformance, voice: QnaLogVoice): string {
	switch (performance) {
		case "correct":
			return voice === "child" ? "They got this" : "You got this";
		case "partial":
			return "Almost there";
		case "incorrect":
			return "Not quite";
		default:
			return "Awaiting grade";
	}
}

function actorSubject(voice: QnaLogVoice): { picked: string; tried: string } {
	if (voice === "child") return { picked: "Your child picked", tried: "What they tried" };
	return { picked: "You picked", tried: "What you tried" };
}

function trimmedOption(text: string | undefined): string {
	if (!text) return "";
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length > 120 ? `${collapsed.slice(0, 120)}…` : collapsed;
}

export type VerdictNarrative =
	| { kind: "graded-mcq"; sentence: string; chosen: string | null; correct: string }
	| { kind: "graded-text"; chosenLabel: string; chosenAnswer: string; correctLabel: string; correctAnswer: string }
	| { kind: "pending"; chosenLabel: string; chosenAnswer: string; note: string };

export function buildVerdictNarrative(detail: QnaLogDetail, voice: QnaLogVoice): VerdictNarrative {
	const actor = actorSubject(voice);

	if (detail.testStatus !== "graded") {
		return {
			kind: "pending",
			chosenLabel: actor.tried,
			chosenAnswer: detail.studentAnswerDisplay,
			note: "Coach notes appear after grading.",
		};
	}

	if (detail.questionType === "multiple_choice") {
		const correctKey = detail.correctOptionKey;
		const chosenKey = detail.studentSelectedKey;
		const correctText = correctKey ? trimmedOption(detail.options?.[correctKey]) : "";
		const chosenText = chosenKey ? trimmedOption(detail.options?.[chosenKey]) : "";
		const correctClause = correctKey ?
				correctText ? `${correctKey}: ${correctText}`
				:	correctKey
			:	(detail.correctAnswerDisplay ?? "—");

		const chosenClause = chosenKey ?
				chosenText ? `${chosenKey}: ${chosenText}`
				:	chosenKey
			:	null;

		let sentence: string;
		if (!chosenKey) {
			sentence = `No option selected. The answer was ${correctClause}.`;
		} else if (correctKey && chosenKey === correctKey) {
			sentence = `${actor.picked} ${chosenClause}. That is the answer.`;
		} else {
			sentence = `${actor.picked} ${chosenClause}. The answer was ${correctClause}.`;
		}

		return { kind: "graded-mcq", sentence, chosen: chosenClause, correct: correctClause };
	}

	return {
		kind: "graded-text",
		chosenLabel: actor.tried,
		chosenAnswer: detail.studentAnswerDisplay,
		correctLabel: "What was right",
		correctAnswer: detail.correctAnswerDisplay ?? "—",
	};
}
