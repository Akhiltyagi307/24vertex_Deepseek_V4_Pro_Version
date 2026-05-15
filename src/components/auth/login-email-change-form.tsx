"use client";

import { MailIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const raisedInputClass =
	"h-10 w-full rounded-md border border-border/90 bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors dark:border-input dark:bg-input/35";

const emailSchema = z.object({
	nextEmail: z.string().trim().email("Enter a valid email address."),
});

export function LoginEmailChangeForm({
	currentEmail,
	inputIdPrefix = "loginEmail",
	variant = "card",
}: {
	currentEmail: string;
	inputIdPrefix?: string;
	/** `embedded`: heading + fields only (for tab panels that already provide chrome). */
	variant?: "card" | "embedded";
}) {
	const [nextEmail, setNextEmail] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function submit() {
		setError(null);
		setSuccess(false);
		const trimmedCurrent = currentEmail.trim().toLowerCase();
		const parsed = emailSchema.safeParse({ nextEmail });
		if (!parsed.success) {
			setError(parsed.error.flatten().fieldErrors.nextEmail?.[0] ?? "Invalid email.");
			return;
		}
		const normalized = parsed.data.nextEmail.trim().toLowerCase();
		if (normalized === trimmedCurrent) {
			setError("That’s already your login email.");
			return;
		}
		setBusy(true);
		const supabase = createClient();
		const { error: updErr } = await supabase.auth.updateUser({ email: normalized });
		setBusy(false);
		if (updErr) {
			setError(updErr.message);
			return;
		}
		setSuccess(true);
		setNextEmail("");
	}

	const fieldsBlock = (
		<div className="space-y-4">
			<Field>
				<FieldLabel className="text-muted-foreground">Current</FieldLabel>
				<FieldContent>
					<Input readOnly value={currentEmail || "—"} className="bg-muted/40 font-medium" />
				</FieldContent>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${inputIdPrefix}Next`}>New email</FieldLabel>
				<FieldContent>
					<Input
						id={`${inputIdPrefix}Next`}
						type="email"
						autoComplete="email"
						value={nextEmail}
						onChange={(e) => setNextEmail(e.target.value)}
						className={raisedInputClass}
					/>
					<FieldDescription>If you use Google sign-in only, password email flows may not apply.</FieldDescription>
				</FieldContent>
			</Field>
			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Could not update email</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}
			{success ? (
				<Alert>
					<AlertTitle>Check your inbox</AlertTitle>
					<AlertDescription>
						We submitted the email change. Confirm any verification message from your auth provider to finish.
					</AlertDescription>
				</Alert>
			) : null}
			<Button type="button" disabled={busy} onClick={() => void submit()}>
				{busy ? "Saving…" : "Update login email"}
			</Button>
		</div>
	);

	if (variant === "embedded") {
		return (
			<div className="flex flex-col gap-6">
				<div className="space-y-1">
					<h2 className="font-semibold text-lg tracking-tight text-foreground">Login email</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Change the address you use to sign in. If your project sends confirmations, Supabase may email you to verify
						the new address before it becomes active.
					</p>
				</div>
				{fieldsBlock}
			</div>
		);
	}

	return (
		<Card className="border-border/80 shadow-sm">
			<CardHeader className="space-y-1">
				<CardTitle className="flex items-center gap-2 text-lg">
					<MailIcon className="size-4 text-muted-foreground" aria-hidden />
					Login email
				</CardTitle>
				<CardDescription>
					Change the address you use to sign in. If your project sends confirmations, Supabase may email you to verify
					the new address before it becomes active.
				</CardDescription>
			</CardHeader>
			<CardContent>{fieldsBlock}</CardContent>
		</Card>
	);
}
