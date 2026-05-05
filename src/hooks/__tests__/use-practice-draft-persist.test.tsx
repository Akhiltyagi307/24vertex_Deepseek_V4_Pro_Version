/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePracticeDraftPersist } from "@/hooks/use-practice-draft-persist";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import { renderHook } from "@/test/render-hook";

const TEST_ID = "00000000-0000-0000-0000-000000000077";

// Node 25's experimental WebStorage stub overrides jsdom's full implementation
// and is missing methods like `clear()`. Replace with a hand-rolled in-memory
// shim so production code's bare `localStorage.*` calls behave consistently.
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
	vi.clearAllMocks();
});

const ans = (kind: SessionStudentAnswer["kind"], value: string): SessionStudentAnswer =>
	({ kind, value }) as SessionStudentAnswer;

describe("usePracticeDraftPersist", () => {
	it("writes a versioned draft to localStorage on mount", () => {
		const answers = { q1: ans("mcq", "A") };
		const flagged = { q1: true };
		const h = renderHook(() =>
			usePracticeDraftPersist({ testId: TEST_ID, answers, flagged }),
		);
		const raw = localStorage.getItem(`eduai:practice-answers-draft:${TEST_ID}`);
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw!);
		expect(parsed).toMatchObject({
			v: 1,
			testId: TEST_ID,
			answers: { q1: { kind: "mcq", value: "A" } },
			flagged: { q1: true },
		});
		h.cleanup();
	});

	it("rewrites the draft when answers change", () => {
		let answers: Record<string, SessionStudentAnswer> = { q1: ans("text", "first") };
		const flagged: Record<string, boolean> = { q1: false };
		const h = renderHook(() =>
			usePracticeDraftPersist({ testId: TEST_ID, answers, flagged }),
		);
		answers = { q1: ans("text", "second"), q2: ans("text", "added") };
		h.rerender(() => usePracticeDraftPersist({ testId: TEST_ID, answers, flagged }));
		const raw = localStorage.getItem(`eduai:practice-answers-draft:${TEST_ID}`);
		const parsed = JSON.parse(raw!);
		expect(parsed.answers.q1).toEqual({ kind: "text", value: "second" });
		expect(parsed.answers.q2).toEqual({ kind: "text", value: "added" });
		h.cleanup();
	});

	it("keys writes by testId", () => {
		const TEST_ID_B = "00000000-0000-0000-0000-000000000099";
		const answers = { q1: ans("mcq", "A") };
		const flagged = {};
		const ha = renderHook(() =>
			usePracticeDraftPersist({ testId: TEST_ID, answers, flagged }),
		);
		const hb = renderHook(() =>
			usePracticeDraftPersist({ testId: TEST_ID_B, answers, flagged }),
		);
		expect(localStorage.getItem(`eduai:practice-answers-draft:${TEST_ID}`)).toBeTruthy();
		expect(localStorage.getItem(`eduai:practice-answers-draft:${TEST_ID_B}`)).toBeTruthy();
		ha.cleanup();
		hb.cleanup();
	});
});
