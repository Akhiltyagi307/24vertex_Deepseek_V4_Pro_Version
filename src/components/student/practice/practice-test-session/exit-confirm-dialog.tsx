"use client";

import { Dialog } from "@base-ui/react/dialog";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExitConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	unsyncedCount: number;
	onCancel: () => void;
	onConfirm: () => void;
};

export function ExitConfirmDialog({
	open,
	onOpenChange,
	unsyncedCount,
	onCancel,
	onConfirm,
}: ExitConfirmDialogProps) {
	const titleId = React.useId();
	const descId = React.useId();

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl medium:gap-6 medium:p-8",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<div className="flex flex-col gap-2 pe-8">
						<Dialog.Title
							id={titleId}
							className="font-heading text-foreground text-xl font-bold tracking-tight medium:text-2xl"
						>
							Leave practice session?
						</Dialog.Title>
						<Dialog.Description
							id={descId}
							className="text-foreground/85 text-sm font-medium leading-relaxed medium:text-base"
						>
							{unsyncedCount > 0 ? (
								<>
									You have <span className="text-destructive font-semibold">{unsyncedCount}</span>{" "}
									unsynced answer{unsyncedCount === 1 ? "" : "s"}. Clicking Leave will try to save
									them first. If you are offline, consider reconnecting before leaving.
								</>
							) : (
								<>
									All your answers are saved. You can return to this test from Practice at any time.
								</>
							)}
						</Dialog.Description>
					</div>
					<div className="border-border flex flex-col-reverse gap-3 border-t-2 pt-5 medium:flex-row medium:justify-end medium:gap-3 medium:pt-6">
						<Button
							type="button"
							variant="outline"
							size="lg"
							className="h-11 min-h-11 px-6 text-base font-semibold medium:min-w-[10rem]"
							onClick={onCancel}
						>
							Stay
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="lg"
							className="h-11 min-h-11 px-6 text-base font-semibold medium:min-w-[10rem]"
							onClick={onConfirm}
						>
							Leave
						</Button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
