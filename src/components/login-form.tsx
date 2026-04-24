"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { cn } from "@/lib/utils";

/** Limit URL-driven callback errors so long values cannot be used for social-engineering walls of text. */
const MAX_CALLBACK_ERROR_DISPLAY = 400;

function sanitizeLoginErrorMessage(raw: string): string {
	const collapsed = raw.replace(/\s+/g, " ").trim();
	if (collapsed.length <= MAX_CALLBACK_ERROR_DISPLAY) {
		return collapsed;
	}
	return `${collapsed.slice(0, MAX_CALLBACK_ERROR_DISPLAY)}…`;
}

type Props = {
	callbackError?: string;
	/** Set after email confirmation + profile creation — user should sign in with password. */
	emailVerified?: boolean;
	className?: string;
} & Omit<React.ComponentProps<"form">, "onSubmit">;

export function LoginForm({ callbackError, emailVerified, className, ...props }: Props) {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const callbackMessage = useMemo(() => {
		if (!callbackError?.trim()) return null;
		try {
			return sanitizeLoginErrorMessage(decodeURIComponent(callbackError));
		} catch {
			return sanitizeLoginErrorMessage(callbackError);
		}
	}, [callbackError]);

	const displayError =
		error != null ? sanitizeLoginErrorMessage(error) : callbackMessage;

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);
		setPending(true);
		const form = e.currentTarget;
		const fd = new FormData(form);
		const email = String(fd.get("email") ?? "").trim();
		const password = String(fd.get("password") ?? "");

		const supabase = createClient();
		const { error: signInError } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (signInError) {
			setError(signInError.message);
			setPending(false);
			return;
		}

		// Full navigation so middleware refreshes cookies before RSC runs (avoids a stale
		// server action reading no session right after signInWithPassword).
		window.location.assign("/");
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={cn("flex flex-col gap-6", className)}
			{...props}
		>
			<FieldGroup>
				<div className="flex flex-col items-center gap-1 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
					<p className="text-sm text-balance text-muted-foreground">
						Sign in with the email and password you used when you registered for EduAI.
					</p>
				</div>
				<AnimateFormAlert show={Boolean(emailVerified)} motionKey="login-email-verified">
					<Alert>
						<AlertTitle>Email confirmed</AlertTitle>
						<AlertDescription>
							Your account is ready. Sign in with the email and password you chose when you
							registered.
						</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<AnimateFormAlert show={Boolean(displayError)} motionKey="login-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{displayError}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<Field>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="m@example.com"
						autoComplete="email"
						required
					/>
				</Field>
				<Field>
					<div className="flex items-center">
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Link
							href="/forgot-password"
							className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
						>
							Forgot your password?
						</Link>
					</div>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
					/>
				</Field>
				<Field>
					<Button type="submit" className="w-full" disabled={pending}>
						{pending ? "Please wait…" : "Log in"}
					</Button>
				</Field>
				<FieldDescription className="text-center text-muted-foreground">
					No account?{" "}
					<Link
						href="/signup/role-picker"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Sign up
					</Link>
				</FieldDescription>
			</FieldGroup>
		</form>
	);
}
