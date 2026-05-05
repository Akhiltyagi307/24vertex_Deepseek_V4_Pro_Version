"use client";

import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReportQuestionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	reportReason: string;
	onReportReasonChange: (value: string) => void;
	reportSubmitting: boolean;
	flagNotice: string | null;
	canSubmit: boolean;
	onSubmit: () => void;
	onCancel: () => void;
};

export function ReportQuestionDialog({
	open,
	onOpenChange,
	reportReason,
	onReportReasonChange,
	reportSubmitting,
	flagNotice,
	canSubmit,
	onSubmit,
	onCancel,
}: ReportQuestionDialogProps) {
	return (
		<Dialog.Root open={open} onOpenChange={(o) => !reportSubmitting && onOpenChange(o)}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<Dialog.Title className="font-heading text-xl font-bold tracking-tight">
						Report this question
					</Dialog.Title>
					<Dialog.Description className="text-foreground/80 text-sm leading-relaxed">
						Tell us what&apos;s wrong (ambiguous, factually incorrect, unclear wording…). Your answer
						is not affected.
					</Dialog.Description>
					<textarea
						value={reportReason}
						onChange={(e) => onReportReasonChange(e.target.value)}
						rows={3}
						maxLength={1000}
						className="border-input bg-background focus-visible:ring-ring w-full rounded-md border-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
						placeholder="Describe the issue"
					/>
					{flagNotice ? (
						<p className="text-emerald-700 dark:text-emerald-400 text-sm" role="status">
							{flagNotice}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" onClick={onCancel} disabled={reportSubmitting}>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={reportSubmitting || !canSubmit}
							onClick={onSubmit}
						>
							{reportSubmitting ? "Reporting…" : "Submit"}
						</Button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
