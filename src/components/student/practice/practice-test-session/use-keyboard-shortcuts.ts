"use client";

import * as React from "react";

import { isAnswered, type SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { isTypingTarget } from "./shared";

export type UseKeyboardShortcutsArgs = {
	sortedRef: React.MutableRefObject<PracticeSessionQuestion[]>;
	answersRef: React.MutableRefObject<Record<string, SessionStudentAnswer>>;
	active: PracticeSessionQuestion | undefined;
	activeIdx: number;
	totalQuestions: number;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	flushSave: (
		questionId: string,
		payload: SessionStudentAnswer,
		markReview: boolean,
	) => Promise<void>;
	onMcqChange: (q: PracticeSessionQuestion, letter: string) => void;
	setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
	setFlagged: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
	setSkipped: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
	setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useKeyboardShortcuts({
	sortedRef,
	answersRef,
	active,
	activeIdx,
	totalQuestions,
	answers,
	flagged,
	flushSave,
	onMcqChange,
	setActiveIdx,
	setFlagged,
	setSkipped,
	setShortcutsOpen,
}: UseKeyboardShortcutsArgs) {
	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTypingTarget(e.target)) return;
			const k = e.key;
			const gotoNextUnanswered = () => {
				const list = sortedRef.current;
				for (let i = activeIdx + 1; i < list.length; i++) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
				for (let i = 0; i < activeIdx; i++) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
			};
			const gotoPrevUnanswered = () => {
				const list = sortedRef.current;
				for (let i = activeIdx - 1; i >= 0; i--) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
				for (let i = list.length - 1; i > activeIdx; i--) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
			};
			if (k === "j" || k === "J" || k === "ArrowRight") {
				e.preventDefault();
				setActiveIdx((i) => Math.min(totalQuestions - 1, i + 1));
				return;
			}
			if (k === "k" || k === "K" || k === "ArrowLeft") {
				e.preventDefault();
				setActiveIdx((i) => Math.max(0, i - 1));
				return;
			}
			if (k === "n" || k === "N") {
				e.preventDefault();
				gotoNextUnanswered();
				return;
			}
			if (k === "p" || k === "P") {
				e.preventDefault();
				gotoPrevUnanswered();
				return;
			}
			if (k === "f" || k === "F") {
				if (!active) return;
				e.preventDefault();
				const next = !(flagged[active.id] ?? false);
				setFlagged((prev) => ({ ...prev, [active.id]: next }));
				const payload = answers[active.id];
				if (payload) void flushSave(active.id, payload, next);
				return;
			}
			if (k === "s" || k === "S") {
				if (!active) return;
				e.preventDefault();
				setSkipped((prev) => ({ ...prev, [active.id]: !(prev[active.id] ?? false) }));
				return;
			}
			if (k === "?") {
				e.preventDefault();
				setShortcutsOpen((v) => !v);
				return;
			}
			if (active && active.question_type === "multiple_choice" && active.options && /^[a-dA-D]$/.test(k)) {
				e.preventDefault();
				const letter = k.toUpperCase();
				if (active.options[letter] != null) {
					onMcqChange(active, letter);
				}
				return;
			}
			if (active && active.question_type === "multiple_choice" && /^[1-4]$/.test(k)) {
				e.preventDefault();
				const letter = ["A", "B", "C", "D"][Number.parseInt(k, 10) - 1]!;
				if (active.options?.[letter] != null) {
					onMcqChange(active, letter);
				}
				return;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		totalQuestions,
		active,
		activeIdx,
		answers,
		flagged,
		flushSave,
		onMcqChange,
		sortedRef,
		answersRef,
		setActiveIdx,
		setFlagged,
		setSkipped,
		setShortcutsOpen,
	]);
}
