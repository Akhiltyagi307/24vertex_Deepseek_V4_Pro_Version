import { BookmarkIcon, CheckIcon } from "lucide-react";

import {
	isAnswered,
	type SessionStudentAnswer,
	questionTypeLabel,
	questionTypeNavLabel,
} from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";

export function QuestionNavList({
	sorted,
	activeId,
	answers,
	flagged,
	skipped,
	onPickIndex,
}: {
	sorted: PracticeSessionQuestion[];
	activeId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	skipped: Record<string, boolean>;
	onPickIndex: (index: number) => void;
}) {
	return (
		<ol className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pr-1">
			{sorted.map((q, idx) => {
				const done = isAnswered(q, answers[q.id]);
				const isActive = q.id === activeId;
				const isFlagged = flagged[q.id];
				const isSkipped = skipped[q.id] && !done;
				return (
					<li key={q.id}>
						<button
							type="button"
							onClick={() => onPickIndex(idx)}
							className={cn(
								"flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-sm shadow-sm transition-[background-color,border-color,box-shadow] motion-reduce:transition-none",
								done ?
									cn(
										"border-emerald-600 bg-emerald-600/[0.09] dark:border-emerald-500 dark:bg-emerald-500/12",
										isActive ?
											"ring-2 ring-emerald-500/45 ring-offset-2 ring-offset-background"
										:	"hover:bg-emerald-600/14 dark:hover:bg-emerald-500/16",
									)
								:	isActive ?
									"border-primary/60 bg-primary/8 text-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background dark:border-primary/50 dark:bg-primary/15"
								:	"border-foreground/15 bg-background text-foreground hover:border-foreground/25 hover:bg-muted/70 dark:border-border dark:bg-card dark:hover:bg-muted/50",
							)}
						>
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums",
									done ?
										"border-emerald-600/35 bg-emerald-600/12 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100"
									:	"border-foreground/25 bg-muted/90 text-foreground dark:border-border dark:bg-muted dark:text-foreground",
								)}
								aria-hidden
							>
								{q.question_number}
							</span>
							<span
								className={cn(
									"min-w-0 flex-1 truncate rounded-full px-2.5 py-1 text-left text-[11px] font-semibold leading-none tracking-tight",
									done ?
										"bg-emerald-600/18 text-emerald-950 dark:bg-emerald-500/22 dark:text-emerald-50"
									:	isActive ?
										"bg-primary/18 text-foreground dark:bg-primary/22"
									:	"bg-foreground/[0.08] text-foreground/90 dark:bg-muted dark:text-foreground/85",
								)}
								title={questionTypeLabel(q.question_type)}
							>
								{questionTypeNavLabel(q.question_type)}
							</span>
							<span className="flex shrink-0 items-center gap-1.5">
								{isSkipped ? (
									<span
										className="border-foreground/30 text-foreground/70 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
										title="Skipped"
									>
										Skip
									</span>
								) : null}
								{isFlagged ?
									<BookmarkIcon
										className="text-amber-600 dark:text-amber-400 size-4"
										aria-label="Marked for review"
									/>
								:	null}
								{done ?
									<span
										className="flex size-8 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
										aria-hidden
									>
										<CheckIcon className="size-4" strokeWidth={2.5} />
									</span>
								:	null}
							</span>
						</button>
					</li>
				);
			})}
		</ol>
	);
}
