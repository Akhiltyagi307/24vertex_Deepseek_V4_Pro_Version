"use client";

import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";
import { BookmarkIcon, CheckIcon, CircleDashedIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { confirmSubmitCta } from "./shared";

export type FinishConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	progressPct: number;
	answeredCount: number;
	totalQuestions: number;
	unansweredCount: number;
	flaggedCount: number;
	submitting: boolean;
	submitError: string | null;
	onCancel: () => void;
	onConfirm: () => void;
};

export function FinishConfirmDialog({
	open,
	onOpenChange,
	progressPct,
	answeredCount,
	totalQuestions,
	unansweredCount,
	flaggedCount,
	submitting,
	submitError,
	onCancel,
	onConfirm,
}: FinishConfirmDialogProps) {
	const titleId = React.useId();
	const descId = React.useId();

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next && submitting) return;
				onOpenChange(next);
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex max-h-[min(92vh,44rem)] w-[min(calc(100vw-2rem),40rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-y-auto rounded-2xl border-2 border-border/80 bg-popover p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/[0.06] dark:ring-foreground/10",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<div
						className="h-1 w-full shrink-0 rounded-t-[0.9rem] bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-400"
						aria-hidden
					/>
					<div className="flex flex-col gap-6 p-6 medium:gap-7 medium:p-8">
						<Button
							type="button"
							variant="ghost"
							size="icon-lg"
							className="absolute top-5 right-4 shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground medium:top-6 medium:right-5"
							onClick={onCancel}
							disabled={submitting}
							aria-label="Close"
						>
							<XIcon />
						</Button>

						<div className="flex flex-col gap-3 pe-10 medium:pe-12">
							<p className="text-emerald-700 dark:text-emerald-400/90 text-[11px] font-semibold uppercase tracking-[0.14em]">
								Practice test
							</p>
							<Dialog.Title
								id={titleId}
								className="font-heading text-foreground text-2xl font-bold tracking-tight medium:text-3xl"
							>
								Finish and submit?
							</Dialog.Title>
							<Dialog.Description
								id={descId}
								className="text-muted-foreground text-sm leading-relaxed medium:text-base"
							>
								You&apos;re about to hand in this test. Review the summary below — you can still go back
								and edit answers until you confirm.
							</Dialog.Description>
						</div>

						<div className="from-muted/40 border-border/80 bg-gradient-to-b to-muted/15 flex flex-col gap-4 rounded-2xl border p-4 medium:p-5">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<h2 className="text-foreground text-sm font-semibold tracking-tight medium:text-base">
									Your progress
								</h2>
								<Badge
									variant="outline"
									className="border-emerald-600/35 bg-emerald-600/10 text-emerald-900 tabular-nums font-semibold dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-100"
								>
									{progressPct}% complete
								</Badge>
							</div>
							<div
								className="bg-foreground/10 dark:bg-muted h-2 w-full overflow-hidden rounded-full"
								role="progressbar"
								aria-valuenow={progressPct}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label="Share of questions answered"
							>
								<div
									className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-emerald-500"
									style={{ width: `${progressPct}%` }}
								/>
							</div>
							<div className="grid gap-3 medium:grid-cols-3">
								<div className="border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
										<CheckIcon className="size-4" strokeWidth={2.5} aria-hidden />
									</div>
									<div className="min-w-0">
										<p className="text-muted-foreground text-xs font-medium">Answered</p>
										<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
											{answeredCount}
											<span className="text-muted-foreground text-base font-semibold">
												/{totalQuestions}
											</span>
										</p>
									</div>
								</div>
								<div
									className={cn(
										"border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5",
										unansweredCount > 0 ?
											"border-amber-500/35 bg-amber-500/[0.06] dark:border-amber-400/30 dark:bg-amber-400/[0.07]"
										:	null,
									)}
								>
									<div
										className={cn(
											"flex size-9 shrink-0 items-center justify-center rounded-lg",
											unansweredCount > 0 ?
												"bg-amber-500/15 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
											:	"bg-muted text-muted-foreground",
										)}
									>
										<CircleDashedIcon className="size-4" strokeWidth={2} aria-hidden />
									</div>
									<div className="min-w-0">
										<p className="text-muted-foreground text-xs font-medium">Still blank</p>
										<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
											{unansweredCount}
										</p>
										{unansweredCount === 0 ?
											<p className="text-muted-foreground mt-1 text-[11px] leading-snug">
												All questions have an answer.
											</p>
										:	null}
									</div>
								</div>
								<div
									className={cn(
										"border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5",
										flaggedCount > 0 ?
											"border-amber-600/25 bg-amber-500/[0.04] dark:border-amber-400/25"
										:	null,
									)}
								>
									<div
										className={cn(
											"flex size-9 shrink-0 items-center justify-center rounded-lg",
											flaggedCount > 0 ?
												"bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
											:	"bg-muted text-muted-foreground",
										)}
									>
										<BookmarkIcon className="size-4" strokeWidth={2} aria-hidden />
									</div>
									<div className="min-w-0">
										<p className="text-muted-foreground text-xs font-medium">For review</p>
										<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
											{flaggedCount}
										</p>
										<p className="text-muted-foreground mt-1 text-[11px] leading-snug">
											{flaggedCount > 0 ?
												"Reminder only — you can submit anytime."
											:	"No questions flagged."}
										</p>
									</div>
								</div>
							</div>
						</div>

						<p className="text-muted-foreground border-border/60 -mt-1 border-t pt-5 text-sm leading-relaxed medium:text-[0.9375rem]">
							After you submit, we grade your work and open your report for this subject, with this
							attempt highlighted.
						</p>

						{submitError ?
							<p className="text-destructive -mt-2 text-sm font-semibold medium:text-base" role="alert">
								{submitError}
							</p>
						:	null}

						<div className="border-border/70 flex flex-col-reverse gap-3 border-t pt-5 medium:flex-row medium:items-center medium:justify-end medium:gap-3 medium:pt-6">
							<p className="text-muted-foreground hidden text-center text-[11px] leading-snug medium:me-auto medium:block medium:text-left">
								<span className="font-medium text-foreground/80">Tip:</span>{" "}
								<kbd className="bg-muted border-border rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
									Esc
								</kbd>{" "}
								returns to the test.
							</p>
							<div className="flex flex-col-reverse gap-2.5 medium:flex-row medium:gap-3">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="h-11 min-h-11 rounded-xl px-6 text-base font-semibold medium:min-w-[10.5rem]"
									onClick={onCancel}
									disabled={submitting}
								>
									Keep working
								</Button>
								<Button
									type="button"
									size="lg"
									className={cn(
										confirmSubmitCta,
										"h-11 min-h-11 rounded-xl px-6 text-base font-semibold shadow-sm medium:min-w-[10.5rem]",
									)}
									disabled={submitting}
									onClick={onConfirm}
								>
									{submitting ? "Submitting…" : "Submit test"}
								</Button>
							</div>
						</div>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
