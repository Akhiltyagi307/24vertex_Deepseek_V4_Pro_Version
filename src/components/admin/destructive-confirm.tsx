"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DestructiveConfirmProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: React.ReactNode;
	confirmText: string;
	requireTotp?: boolean;
	onConfirm: (input: { totp?: string }) => void | Promise<void>;
	submitLabel?: string;
};

export function DestructiveConfirm({
	open,
	onOpenChange,
	title,
	description,
	confirmText,
	requireTotp,
	onConfirm,
	submitLabel = "Confirm",
}: DestructiveConfirmProps) {
	const [typed, setTyped] = useState("");
	const [totp, setTotp] = useState("");
	const [busy, setBusy] = useState(false);

	const canSubmit = typed.trim() === confirmText.trim() && (!requireTotp || /^\d{6}$/.test(totp.trim()));

	const submit = async () => {
		if (!canSubmit) return;
		setBusy(true);
		try {
			await onConfirm({ totp: requireTotp ? totp.trim() : undefined });
			onOpenChange(false);
			setTyped("");
			setTotp("");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="text-destructive">{title}</DialogTitle>
					<DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div>
						<Label htmlFor="destructive-confirm-type">Type {confirmText} to confirm</Label>
						<Input
							id="destructive-confirm-type"
							autoComplete="off"
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							className="mt-1"
						/>
					</div>
					{requireTotp ?
						<div>
							<Label htmlFor="destructive-confirm-totp">TOTP code</Label>
							<Input
								id="destructive-confirm-totp"
								inputMode="numeric"
								autoComplete="one-time-code"
								value={totp}
								onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
								className="mt-1"
								placeholder="000000"
							/>
						</div>
					:	null}
				</div>
				<DialogFooter>
					<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button type="button" variant="destructive" disabled={!canSubmit || busy} onClick={() => void submit()}>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
