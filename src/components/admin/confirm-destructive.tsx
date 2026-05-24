"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
	title: string;
	description: string;
	confirmLabel?: string;
	disabled?: boolean;
	onConfirm: () => void | Promise<void>;
	children: React.ReactNode;
};

/** Minimal destructive confirmation for later phases (no modal dependency). */
export function ConfirmDestructive({
	title,
	description,
	confirmLabel = "Confirm",
	disabled = false,
	onConfirm,
	children,
}: Props) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const blocked = disabled || pending;

	async function handleConfirm() {
		setPending(true);
		try {
			await onConfirm();
			setOpen(false);
		} finally {
			setPending(false);
		}
	}

	if (!open) {
		return (
			<span>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={disabled}
					onClick={() => setOpen(true)}
				>
					{children}
				</Button>
			</span>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-card p-4 shadow-sm">
			<p className="text-sm font-medium">{title}</p>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			<div className="mt-3 flex gap-2">
				<Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={blocked}>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={() => void handleConfirm()}
					disabled={blocked}
					aria-busy={pending}
				>
					{pending ? "Working…" : confirmLabel}
				</Button>
			</div>
		</div>
	);
}
