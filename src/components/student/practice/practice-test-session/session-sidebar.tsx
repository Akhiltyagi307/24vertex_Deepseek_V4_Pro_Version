"use client";

import { KeyboardIcon, ListIcon } from "lucide-react";

import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { QuestionNavList } from "./question-nav-list";
import { Kbd } from "./shared";

export type SessionSidebarProps = {
	sorted: PracticeSessionQuestion[];
	activeId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	skipped: Record<string, boolean>;
	onPickIndex: (index: number) => void;
	onOpenShortcuts: () => void;
};

export function SessionSidebar({
	sorted,
	activeId,
	answers,
	flagged,
	skipped,
	onPickIndex,
	onOpenShortcuts,
}: SessionSidebarProps) {
	return (
		<div
			className="border-border bg-muted hidden w-full shrink-0 rounded-xl border-2 p-4 shadow-sm dark:bg-muted/60 xl:block xl:w-72"
			aria-label="Question list"
		>
			<div className="mb-3 flex items-center gap-2">
				<ListIcon className="text-foreground/70 size-4" aria-hidden />
				<h2 className="text-foreground/80 text-xs font-medium tracking-wide">Questions</h2>
			</div>
			<QuestionNavList
				sorted={sorted}
				activeId={activeId}
				answers={answers}
				flagged={flagged}
				skipped={skipped}
				onPickIndex={onPickIndex}
			/>
			<button
				type="button"
				onClick={onOpenShortcuts}
				className={cn(
					"border-border bg-background text-foreground hover:bg-muted/80 mt-4 flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5",
					"text-left text-sm font-medium shadow-sm transition-[background-color,box-shadow] motion-reduce:transition-none",
					"focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
				)}
			>
				<KeyboardIcon className="text-foreground/65 size-4 shrink-0" aria-hidden />
				<span className="min-w-0 flex-1">Keyboard shortcuts</span>
				<Kbd className="shrink-0 px-2">?</Kbd>
			</button>
		</div>
	);
}
