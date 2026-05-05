/**
 * Practice-session client-side storage helpers (sessionStart + answer draft).
 * No React; safe to import from anywhere. localStorage failures (quota, private
 * mode) are swallowed — these are best-effort caches, never sources of truth.
 */
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";

/* ------------------------------ session start ----------------------------- */

const PRACTICE_SESSION_START_KEY = (testId: string) => `eduai:practice-test-session:${testId}`;

export type PracticeSessionStartPayload = {
	startedAt: number;
	timeLimitSeconds: number;
};

export function readPracticeSessionStart(
	testId: string,
	timeLimitSeconds: number,
): PracticeSessionStartPayload | null {
	try {
		const raw = localStorage.getItem(PRACTICE_SESSION_START_KEY(testId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PracticeSessionStartPayload>;
		if (
			typeof parsed.startedAt !== "number" ||
			!Number.isFinite(parsed.startedAt) ||
			parsed.timeLimitSeconds !== timeLimitSeconds
		) {
			return null;
		}
		return { startedAt: parsed.startedAt, timeLimitSeconds: parsed.timeLimitSeconds };
	} catch {
		return null;
	}
}

export function writePracticeSessionStart(testId: string, startedAt: number, timeLimitSeconds: number) {
	try {
		const payload: PracticeSessionStartPayload = { startedAt, timeLimitSeconds };
		localStorage.setItem(PRACTICE_SESSION_START_KEY(testId), JSON.stringify(payload));
	} catch {
		/* quota / private mode */
	}
}

export function clearPracticeSessionStart(testId: string) {
	try {
		localStorage.removeItem(PRACTICE_SESSION_START_KEY(testId));
	} catch {
		/* ignore */
	}
}

/* -------------------------------- draft cache ----------------------------- */

const PRACTICE_DRAFT_KEY = (testId: string) => `eduai:practice-answers-draft:${testId}`;

export type PracticeAnswersDraftV1 = {
	v: 1;
	testId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
};

export function readPracticeDraft(testId: string): PracticeAnswersDraftV1 | null {
	try {
		const raw = localStorage.getItem(PRACTICE_DRAFT_KEY(testId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PracticeAnswersDraftV1>;
		if (parsed.v !== 1 || parsed.testId !== testId) return null;
		if (!parsed.answers || typeof parsed.answers !== "object") return null;
		if (!parsed.flagged || typeof parsed.flagged !== "object") return null;
		return {
			v: 1,
			testId,
			answers: parsed.answers as Record<string, SessionStudentAnswer>,
			flagged: parsed.flagged as Record<string, boolean>,
		};
	} catch {
		return null;
	}
}

export function writePracticeDraft(testId: string, draft: PracticeAnswersDraftV1) {
	try {
		localStorage.setItem(PRACTICE_DRAFT_KEY(testId), JSON.stringify(draft));
	} catch {
		/* quota / private mode */
	}
}

export function clearPracticeDraft(testId: string) {
	try {
		localStorage.removeItem(PRACTICE_DRAFT_KEY(testId));
	} catch {
		/* ignore */
	}
}

/** Server snapshot wins; draft fills in any unsaved edits for known questions. */
export function mergeServerAndLocalDraft(
	questions: PracticeSessionQuestion[],
	server: { answers: Record<string, SessionStudentAnswer>; flagged: Record<string, boolean> },
	draft: PracticeAnswersDraftV1 | null,
): { answers: Record<string, SessionStudentAnswer>; flagged: Record<string, boolean> } {
	if (!draft) return server;
	const ids = new Set(questions.map((q) => q.id));
	const mergedAnswers = { ...server.answers };
	for (const [qid, a] of Object.entries(draft.answers)) {
		if (ids.has(qid)) mergedAnswers[qid] = a;
	}
	const mergedFlagged = { ...server.flagged };
	for (const [qid, f] of Object.entries(draft.flagged)) {
		if (ids.has(qid)) mergedFlagged[qid] = f;
	}
	return { answers: mergedAnswers, flagged: mergedFlagged };
}
