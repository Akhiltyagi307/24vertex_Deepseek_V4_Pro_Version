/**
 * Practice-session client-side storage helpers (sessionStart + answer draft).
 * No React; safe to import from anywhere. localStorage failures (quota, private
 * mode) are swallowed — these are best-effort caches, never sources of truth.
 */
import type { PracticeFocusArea } from "@/lib/practice/schemas";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from "@/lib/brand/constants";
import {
	readWithLegacyStorageKey,
	removeStorageKey,
	writeStorageKey,
} from "@/lib/brand/storage-shim";

/* ------------------------------ wizard draft ----------------------------- */

const PRACTICE_WIZARD_DRAFT_KEY = `${PRODUCT_SLUG}:practice-wizard-draft:v1`;
const LEGACY_PRACTICE_WIZARD_DRAFT_KEY = `${LEGACY_PRODUCT_SLUG}:practice-wizard-draft:v1`;

/**
 * Per-user practice wizard draft. Survives a refresh / accidental nav so a
 * student doesn't lose their topic selection halfway through configuring.
 * Tied to userId so a different student on the same device doesn't pick up
 * stale state. Tied to a one-day TTL so old drafts don't haunt a returning
 * user.
 */
export type PracticeWizardDraftV1 = {
	v: 1;
	userId: string;
	updatedAt: number;
	step: number;
	subjectId: string | null;
	trackerIds: string[];
	difficulty: "easy" | "medium" | "hard";
	durationSeconds: number;
	focusArea: PracticeFocusArea;
};

const PRACTICE_WIZARD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function readPracticeWizardDraft(userId: string): PracticeWizardDraftV1 | null {
	try {
		const raw = readWithLegacyStorageKey(PRACTICE_WIZARD_DRAFT_KEY, LEGACY_PRACTICE_WIZARD_DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PracticeWizardDraftV1>;
		if (
			parsed.v !== 1 ||
			parsed.userId !== userId ||
			typeof parsed.updatedAt !== "number" ||
			Date.now() - parsed.updatedAt > PRACTICE_WIZARD_DRAFT_TTL_MS
		) {
			return null;
		}
		if (
			typeof parsed.step !== "number" ||
			!Array.isArray(parsed.trackerIds) ||
			(parsed.subjectId !== null && typeof parsed.subjectId !== "string") ||
			(parsed.difficulty !== "easy" && parsed.difficulty !== "medium" && parsed.difficulty !== "hard") ||
			typeof parsed.durationSeconds !== "number"
		) {
			return null;
		}
		return parsed as PracticeWizardDraftV1;
	} catch {
		return null;
	}
}

export function writePracticeWizardDraft(draft: Omit<PracticeWizardDraftV1, "v" | "updatedAt">): void {
	try {
		const payload: PracticeWizardDraftV1 = {
			v: 1,
			updatedAt: Date.now(),
			...draft,
		};
		writeStorageKey(PRACTICE_WIZARD_DRAFT_KEY, JSON.stringify(payload));
	} catch {
		/* quota / private mode */
	}
}

export function clearPracticeWizardDraft(): void {
	try {
		removeStorageKey(PRACTICE_WIZARD_DRAFT_KEY);
		removeStorageKey(LEGACY_PRACTICE_WIZARD_DRAFT_KEY);
	} catch {
		/* ignore */
	}
}

/* ------------------------------ session start ----------------------------- */

const PRACTICE_SESSION_START_KEY = (testId: string) => `${PRODUCT_SLUG}:practice-test-session:${testId}`;
const LEGACY_PRACTICE_SESSION_START_KEY = (testId: string) =>
	`${LEGACY_PRODUCT_SLUG}:practice-test-session:${testId}`;

export type PracticeSessionStartPayload = {
	startedAt: number;
	timeLimitSeconds: number;
};

export function readPracticeSessionStart(
	testId: string,
	timeLimitSeconds: number,
): PracticeSessionStartPayload | null {
	try {
		const raw = readWithLegacyStorageKey(
			PRACTICE_SESSION_START_KEY(testId),
			LEGACY_PRACTICE_SESSION_START_KEY(testId),
		);
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
		writeStorageKey(PRACTICE_SESSION_START_KEY(testId), JSON.stringify(payload));
	} catch {
		/* quota / private mode */
	}
}

export function clearPracticeSessionStart(testId: string) {
	try {
		removeStorageKey(PRACTICE_SESSION_START_KEY(testId));
		removeStorageKey(LEGACY_PRACTICE_SESSION_START_KEY(testId));
	} catch {
		/* ignore */
	}
}

/* -------------------------------- draft cache ----------------------------- */

const PRACTICE_DRAFT_KEY = (testId: string) => `${PRODUCT_SLUG}:practice-answers-draft:${testId}`;
const LEGACY_PRACTICE_DRAFT_KEY = (testId: string) =>
	`${LEGACY_PRODUCT_SLUG}:practice-answers-draft:${testId}`;

export type PracticeAnswersDraftV1 = {
	v: 1;
	testId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
};

export function readPracticeDraft(testId: string): PracticeAnswersDraftV1 | null {
	try {
		const raw = readWithLegacyStorageKey(PRACTICE_DRAFT_KEY(testId), LEGACY_PRACTICE_DRAFT_KEY(testId));
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
		writeStorageKey(PRACTICE_DRAFT_KEY(testId), JSON.stringify(draft));
	} catch {
		/* quota / private mode */
	}
}

export function clearPracticeDraft(testId: string) {
	try {
		removeStorageKey(PRACTICE_DRAFT_KEY(testId));
		removeStorageKey(LEGACY_PRACTICE_DRAFT_KEY(testId));
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
