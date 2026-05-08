"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId } from "react";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DeleteConversationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	deleteHeadline: string;
	deleteInProgress: boolean;
	canDelete: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

export function DeleteConversationDialog({
	open,
	onOpenChange,
	deleteHeadline,
	deleteInProgress,
	canDelete,
	onCancel,
	onConfirm,
}: DeleteConversationDialogProps) {
	const titleId = useId();
	const descId = useId();

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next && deleteInProgress) return;
				onOpenChange(next);
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-zinc-950/55 transition-opacity duration-150 supports-backdrop-filter:backdrop-blur-xs dark:bg-zinc-950/65",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					aria-labelledby={titleId}
					aria-describedby={descId}
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-3 right-3"
						onClick={onCancel}
						disabled={deleteInProgress}
						aria-label="Close"
					>
						<X className="size-4" />
					</Button>
					<div className="flex flex-col gap-2 pe-8">
						<Dialog.Title
							id={titleId}
							className="font-heading text-lg font-semibold tracking-tight medium:text-xl"
						>
							Delete this chat?
						</Dialog.Title>
						<Dialog.Description
							id={descId}
							className="text-muted-foreground text-sm [text-wrap:pretty]"
						>
							<span className="text-foreground font-medium">{deleteHeadline}</span> and its messages
							will be removed from your account. This cannot be undone.
						</Dialog.Description>
					</div>
					<div className="flex flex-col-reverse gap-2 medium:flex-row medium:justify-end">
						<Button type="button" variant="outline" onClick={onCancel} disabled={deleteInProgress}>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							className="gap-1.5"
							onClick={onConfirm}
							disabled={deleteInProgress || !canDelete}
						>
							{deleteInProgress ? (
								<>
									<Loader2 className="size-4 animate-spin" aria-hidden />
									Deleting…
								</>
							) : (
								<>
									<Trash2 className="size-3.5" aria-hidden />
									Delete chat
								</>
							)}
						</Button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
