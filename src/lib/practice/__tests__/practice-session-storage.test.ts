/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import {
	clearPracticeDraft,
	clearPracticeSessionStart,
	mergeServerAndLocalDraft,
	readPracticeDraft,
	readPracticeSessionStart,
	writePracticeDraft,
	writePracticeSessionStart,
} from "@/lib/practice/practice-session-storage";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

const TEST_ID = "00000000-0000-0000-0000-000000000001";

// Node 25's experimental WebStorage stub overrides jsdom's `Storage` and is
// missing methods like `clear()`. Install a hand-rolled in-memory shim so the
// production module's bare `localStorage.*` calls behave consistently.
function createMemoryStorage(): Storage {
	const store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(k: string) {
			return store.get(k) ?? null;
		},
		key(i: number) {
			return Array.from(store.keys())[i] ?? null;
		},
		removeItem(k: string) {
			store.delete(k);
		},
		setItem(k: string, v: string) {
			store.set(k, String(v));
		},
	};
}

beforeEach(() => {
	const ls = createMemoryStorage();
	Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true });
	Object.defineProperty(window, "localStorage", { value: ls, configurable: true });
});

afterEach(() => {
	Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true });
});

describe("practice-session-storage — sessionStart", () => {
	it("round-trips a startedAt + timeLimit pair", () => {
		writePracticeSessionStart(TEST_ID, 1_700_000_000_000, 3600);
		const out = readPracticeSessionStart(TEST_ID, 3600);
		expect(out).toEqual({ startedAt: 1_700_000_000_000, timeLimitSeconds: 3600 });
	});

	it("rejects a stored payload whose time-limit no longer matches the session", () => {
		writePracticeSessionStart(TEST_ID, 1_700_000_000_000, 3600);
		expect(readPracticeSessionStart(TEST_ID, 10800)).toBeNull();
	});

	it("rejects malformed JSON", () => {
		localStorage.setItem(`eduai:practice-test-session:${TEST_ID}`, "{not json");
		expect(readPracticeSessionStart(TEST_ID, 3600)).toBeNull();
	});

	it("rejects payloads with non-finite startedAt", () => {
		localStorage.setItem(
			`eduai:practice-test-session:${TEST_ID}`,
			JSON.stringify({ startedAt: Number.NaN, timeLimitSeconds: 3600 }),
		);
		expect(readPracticeSessionStart(TEST_ID, 3600)).toBeNull();
	});

	it("clear removes the entry", () => {
		writePracticeSessionStart(TEST_ID, 1, 3600);
		clearPracticeSessionStart(TEST_ID);
		expect(readPracticeSessionStart(TEST_ID, 3600)).toBeNull();
	});
});

describe("practice-session-storage — answer draft", () => {
	const answers: Record<string, SessionStudentAnswer> = {
		q1: { kind: "mcq", value: "A" },
		q2: { kind: "text", value: "hello" },
	};
	const flagged: Record<string, boolean> = { q1: true, q2: false };

	it("round-trips a v1 draft", () => {
		writePracticeDraft(TEST_ID, { v: 1, testId: TEST_ID, answers, flagged });
		const out = readPracticeDraft(TEST_ID);
		expect(out).toEqual({ v: 1, testId: TEST_ID, answers, flagged });
	});

	it("rejects a draft with a wrong version", () => {
		localStorage.setItem(
			`eduai:practice-answers-draft:${TEST_ID}`,
			JSON.stringify({ v: 2, testId: TEST_ID, answers, flagged }),
		);
		expect(readPracticeDraft(TEST_ID)).toBeNull();
	});

	it("rejects a draft whose testId mismatches the requested key", () => {
		writePracticeDraft(TEST_ID, { v: 1, testId: "other-test", answers, flagged });
		expect(readPracticeDraft(TEST_ID)).toBeNull();
	});

	it("clear removes the entry", () => {
		writePracticeDraft(TEST_ID, { v: 1, testId: TEST_ID, answers, flagged });
		clearPracticeDraft(TEST_ID);
		expect(readPracticeDraft(TEST_ID)).toBeNull();
	});
});

describe("practice-session-storage — mergeServerAndLocalDraft", () => {
	const questions: PracticeSessionQuestion[] = [
		{
			id: "q1",
			question_number: 1,
			question_text: "?",
			question_type: "multiple_choice",
			difficulty_level: "easy",
			options: { A: "x", B: "y" },
			topic_id: "t1",
			topic_name: "T1",
			chapter_name: null,
		},
		{
			id: "q2",
			question_number: 2,
			question_text: "?",
			question_type: "short_answer",
			difficulty_level: "medium",
			options: null,
			topic_id: "t2",
			topic_name: "T2",
			chapter_name: null,
		},
	];

	const server = {
		answers: { q1: { kind: "mcq" as const, value: "A" } },
		flagged: { q1: false, q2: false },
	};

	it("returns the server snapshot verbatim when no draft is present", () => {
		expect(mergeServerAndLocalDraft(questions, server, null)).toEqual(server);
	});

	it("layers known-question draft answers on top of the server snapshot", () => {
		const draft = {
			v: 1 as const,
			testId: TEST_ID,
			answers: { q2: { kind: "text" as const, value: "in progress" } },
			flagged: { q2: true },
		};
		const merged = mergeServerAndLocalDraft(questions, server, draft);
		expect(merged.answers.q1).toEqual({ kind: "mcq", value: "A" });
		expect(merged.answers.q2).toEqual({ kind: "text", value: "in progress" });
		expect(merged.flagged).toEqual({ q1: false, q2: true });
	});

	it("ignores draft entries for questions not in the current set", () => {
		const draft = {
			v: 1 as const,
			testId: TEST_ID,
			answers: { qDeleted: { kind: "text" as const, value: "stale" } },
			flagged: { qDeleted: true },
		};
		const merged = mergeServerAndLocalDraft(questions, server, draft);
		expect(merged.answers).not.toHaveProperty("qDeleted");
		expect(merged.flagged).not.toHaveProperty("qDeleted");
	});
});
