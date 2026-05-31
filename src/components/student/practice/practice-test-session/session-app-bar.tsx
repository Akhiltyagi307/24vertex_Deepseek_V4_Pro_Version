"use client";

import { ClockIcon, KeyboardIcon, MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { QuestionNavList } from "./question-nav-list";
import { Kbd } from "./shared";

export type SessionAppBarProps = {
	subjectName: string;
	sorted: PracticeSessionQuestion[];
	activeId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	skipped: Record<string, boolean>;
	answeredCount: number;
	flaggedCount: number;
	skippedCount: number;
	progressPct: number;
	timeLabel: string;
	remainingSec: number;
	warnTime: boolean;
	criticalTime: boolean;
	finalCountdown: boolean;
	pauseAllowed: boolean;
	paused: boolean;
	pauseRemainingSec: number;
	serverIsPaused: boolean;
	adminMessage: string | null;
	isOnline: boolean;
	unsyncedCount: number;
	saveUi: "idle" | "saving" | "saved" | "failed";
	navOpen: boolean;
	onNavOpenChange: (open: boolean) => void;
	onPickIndex: (index: number) => void;
	onOpenShortcuts: () => void;
	onStartPause: () => void;
	onDismissAdminMessage: () => void;
	onRetrySave: () => void;
};

export function SessionAppBar({
	subjectName,
	sorted,
	activeId,
	answers,
	flagged,
	skipped,
	answeredCount,
	flaggedCount,
	skippedCount,
	progressPct,
	timeLabel,
	remainingSec,
	warnTime,
	criticalTime,
	finalCountdown,
	pauseAllowed,
	paused,
	pauseRemainingSec,
	serverIsPaused,
	adminMessage,
	isOnline,
	unsyncedCount,
	saveUi,
	navOpen,
	onNavOpenChange,
	onPickIndex,
	onOpenShortcuts,
	onStartPause,
	onDismissAdminMessage,
	onRetrySave,
}: SessionAppBarProps) {
	return (
		<header className="border-border bg-muted/70 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4 rounded-2xl border px-4 py-4 medium:px-5 medium:py-4 dark:bg-card/90 dark:border-border">
			<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
				<div className="min-w-0 space-y-1.5 xl:max-w-[min(100%,42rem)]">
					<p className="text-foreground/55 text-[11px] font-semibold uppercase tracking-[0.08em]">Practice session</p>
					<h1 className="text-foreground text-2xl font-semibold tracking-tight medium:text-3xl">{subjectName}</h1>
				</div>

				<div className="flex flex-col gap-2 medium:flex-row medium:items-stretch medium:justify-end medium:gap-2 xl:shrink-0">
					<Sheet open={navOpen} onOpenChange={onNavOpenChange}>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5 medium:shrink-0 xl:hidden"
							onClick={() => onNavOpenChange(true)}
						>
							<MenuIcon className="size-4" aria-hidden />
							Questions
						</Button>
						<SheetContent side="left" className="w-[min(100%,20rem)] gap-0">
							<SheetHeader className="border-border border-b pb-3">
								<SheetTitle>Jump to question</SheetTitle>
								<SheetDescription>Select a question to continue.</SheetDescription>
							</SheetHeader>
							<div className="flex-1 overflow-y-auto p-4">
								<QuestionNavList
									sorted={sorted}
									activeId={activeId}
									answers={answers}
									flagged={flagged}
									skipped={skipped}
									onPickIndex={(i) => {
										onPickIndex(i);
										onNavOpenChange(false);
									}}
								/>
							</div>
							<SheetFooter className="border-border flex flex-col gap-2 border-t pt-4">
								<Button
									type="button"
									variant="outline"
									className="w-full justify-center gap-2"
									onClick={() => {
										onOpenShortcuts();
										onNavOpenChange(false);
									}}
								>
									<KeyboardIcon className="size-4" aria-hidden />
									Keyboard shortcuts
									<Kbd className="ml-0.5 px-2">?</Kbd>
								</Button>
								<SheetClose render={<Button type="button" variant="outline" className="w-full" />}>
									Close
								</SheetClose>
							</SheetFooter>
						</SheetContent>
					</Sheet>

					<div
						className={cn(
							cardSurfaceFrameClassName,
							"flex w-full overflow-hidden shadow-sm",
							"bg-background dark:bg-card",
							"flex-col divide-y divide-border/90 medium:w-auto medium:min-w-[min(100%,28rem)] medium:flex-row medium:divide-x medium:divide-y-0",
						)}
					>
						<div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-4 py-3.5 medium:max-w-md medium:py-3 medium:pr-5 medium:pl-4">
							<div className="flex items-baseline justify-between gap-3">
								<p className="text-foreground text-sm font-semibold tabular-nums medium:text-base">
									{answeredCount}/{sorted.length} answered
								</p>
								<span className="text-foreground/65 shrink-0 text-sm font-semibold tabular-nums">{progressPct}%</span>
							</div>
							<div
								className="bg-foreground/12 dark:bg-muted h-2 w-full overflow-hidden rounded-full"
								role="progressbar"
								aria-valuenow={progressPct}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label="Share of questions answered"
							>
								<div
									className="motion-safe:transition-[width] h-full rounded-full bg-emerald-600 motion-reduce:transition-none dark:bg-emerald-500"
									style={{ width: `${progressPct}%` }}
								/>
							</div>
							<div className="text-foreground/60 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
								{flaggedCount > 0 ?
									<span className="text-amber-800 dark:text-amber-400 font-medium">
										{flaggedCount} marked for review
									</span>
								:	null}
								{skippedCount > 0 ?
									<span className="text-foreground/70 font-medium">
										{skippedCount} skipped
									</span>
								:	null}
								{!isOnline ? (
									<span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-300">
										Offline — {unsyncedCount} unsynced
									</span>
								) : saveUi === "saving" ? (
									<span className="text-foreground/65">Saving</span>
								) : saveUi === "failed" ? (
									<button
										type="button"
										onClick={onRetrySave}
										className="text-destructive underline decoration-dotted underline-offset-2 hover:text-destructive/80"
									>
										Save failed — retry
									</button>
								) : saveUi === "saved" ? (
									<span className="text-emerald-700 dark:text-emerald-400/90">Saved</span>
								) : null}
							</div>
						</div>

						<div
							className={cn(
								"flex flex-col justify-center gap-1 px-4 py-3.5 medium:min-w-[10.25rem] medium:shrink-0 medium:py-3 medium:pl-5 medium:pr-4",
								warnTime ?
									"bg-amber-500/[0.12] dark:bg-amber-500/15"
								:	"bg-muted/40 dark:bg-muted/25",
							)}
							aria-live="polite"
							aria-atomic="true"
						>
							<span className="text-foreground/65 flex items-center gap-1.5 text-xs font-semibold tracking-tight">
								<ClockIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
								Time left
							</span>
							<span className="font-mono text-3xl font-semibold tabular-nums tracking-tight medium:text-[2rem] medium:leading-none">
								{remainingSec <= 0 ? "0:00" : timeLabel}
							</span>
							{warnTime ?
								<span className="text-amber-900 dark:text-amber-200 text-xs font-semibold">
									{criticalTime ? `${remainingSec}s left` : "Low time"}
								</span>
							:	null}
							{pauseAllowed ? (
								<button
									type="button"
									onClick={onStartPause}
									className="text-foreground/70 hover:text-foreground mt-0.5 self-start text-[11px] underline decoration-dotted underline-offset-2"
								>
									Pause (5 min, once)
								</button>
							) : null}
						</div>
					</div>
				</div>
			</div>
			{serverIsPaused && !paused ? (
				<div
					className="rounded-lg border-2 border-sky-500/40 bg-sky-500/10 px-4 py-3 text-center"
					role="alert"
				>
					<p className="text-sky-950 dark:text-sky-100 text-sm font-semibold">
						Test paused by an operator. Your timer is frozen until they resume.
					</p>
				</div>
			) : null}
			{adminMessage ? (
				<div
					className="flex items-center justify-between gap-2 rounded-lg border-2 border-indigo-500/45 bg-indigo-500/10 px-4 py-3 text-sm"
					role="alert"
				>
					<span className="text-indigo-950 dark:text-indigo-100">
						<strong>Message from your admin:</strong> {adminMessage}
					</span>
					<button
						type="button"
						className="text-indigo-900/70 dark:text-indigo-100/80 shrink-0 text-xs underline"
						onClick={onDismissAdminMessage}
					>
						Dismiss
					</button>
				</div>
			) : null}
			{paused ? (
				<div
					className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center"
					role="alert"
				>
					<p className="text-amber-900 dark:text-amber-200 text-sm font-semibold">
						Paused · {Math.floor(pauseRemainingSec / 60)}:
						{String(pauseRemainingSec % 60).padStart(2, "0")} remaining
					</p>
				</div>
			) : null}
			{!paused && !serverIsPaused && finalCountdown ? (
				<div
					className="border-destructive/60 bg-destructive/10 rounded-lg border-2 px-4 py-2 text-center"
					role="alert"
				>
					<p className="text-destructive text-sm font-semibold">
						Submitting in {remainingSec}s
					</p>
				</div>
			) : null}
		</header>
	);
}
