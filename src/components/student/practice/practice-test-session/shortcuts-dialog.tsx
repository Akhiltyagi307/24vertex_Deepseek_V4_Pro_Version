"use client";

import { Dialog } from "@base-ui/react/dialog";
import { KeyboardIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Kbd } from "./shared";

export type ShortcutsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
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
						"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<div className="flex items-start gap-3">
						<div className="bg-muted/80 flex size-10 shrink-0 items-center justify-center rounded-xl border">
							<KeyboardIcon className="text-foreground/70 size-5" aria-hidden />
						</div>
						<div className="min-w-0 space-y-1">
							<Dialog.Title className="font-heading text-xl font-bold tracking-tight">
								Keyboard shortcuts
							</Dialog.Title>
							<Dialog.Description className="text-foreground/70 text-sm leading-snug">
								Use these keys when you are not typing in an answer field.
							</Dialog.Description>
						</div>
					</div>
					<dl className="flex flex-col gap-3.5 text-sm">
						<div className="flex items-start gap-3">
							<dt className="flex shrink-0 flex-wrap items-center gap-1">
								<Kbd>J</Kbd>
								<span className="text-muted-foreground px-0.5">/</span>
								<Kbd>→</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Next question</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt className="flex shrink-0 flex-wrap items-center gap-1">
								<Kbd>K</Kbd>
								<span className="text-muted-foreground px-0.5">/</span>
								<Kbd>←</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Previous question</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt>
								<Kbd>N</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Next unanswered</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt>
								<Kbd>P</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Previous unanswered</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt>
								<Kbd>F</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Flag / unflag for review</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt>
								<Kbd>S</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Skip / unskip</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt className="flex shrink-0 flex-wrap items-center gap-1">
								<Kbd>A</Kbd>
								<span className="text-muted-foreground">–</span>
								<Kbd>D</Kbd>
								<span className="text-muted-foreground px-0.5">·</span>
								<Kbd>1</Kbd>
								<span className="text-muted-foreground">–</span>
								<Kbd>4</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Choose MCQ option</dd>
						</div>
						<div className="flex items-start gap-3">
							<dt>
								<Kbd>?</Kbd>
							</dt>
							<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Open or close this panel</dd>
						</div>
					</dl>
					<div className="flex justify-end">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
