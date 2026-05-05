"use client";

import { useEffect } from "react";

import { writePracticeDraft } from "@/lib/practice/practice-session-storage";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

type Args = {
	testId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
};

/**
 * Persists the in-progress answer/flag map to localStorage on every change.
 * The write is best-effort; quota / private-mode errors are swallowed inside
 * `writePracticeDraft`. Keeping this as a one-line effect lets the session
 * component stay focused on UI state, and lets a future debounce land here
 * without touching the consumer.
 */
export function usePracticeDraftPersist({ testId, answers, flagged }: Args): void {
	useEffect(() => {
		writePracticeDraft(testId, { v: 1, testId, answers, flagged });
	}, [testId, answers, flagged]);
}
