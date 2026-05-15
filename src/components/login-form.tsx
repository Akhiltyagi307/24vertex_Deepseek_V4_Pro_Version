"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { postAuthPathFromProfile } from "@/lib/auth/post-auth-path";
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
	/**
	 * Educator login: same shell as students, with teacher signup link and educator marketing column
	 * (see `AuthStudioCardGate`). Post-auth routing still uses `profiles.role` / `is_verified`.
	 */
	variant?: "default" | "educator";
	className?: string;
} & Omit<React.ComponentProps<"form">, "onSubmit">;

export function LoginForm({
	callbackError,
	emailVerified,
	variant = "default",
	className,
	...props
}: Props) {
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
		const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (signInError) {
			setError(signInError.message);
			setPending(false);
			return;
		}

		const userId = signInData.user?.id;
		if (!userId) {
			window.location.replace("/");
			return;
		}

		const { error: profileError, data: profileRow } = await supabase
			.from("profiles")
			.select("role, is_verified")
			.eq("id", userId)
			.maybeSingle();

		if (profileError) {
			// Prefer a single server-driven hop if the profile read fails (rare).
			window.location.replace("/");
			return;
		}

		const destination = postAuthPathFromProfile(
			profileRow ? { role: profileRow.role, is_verified: profileRow.is_verified } : null,
		);
		window.location.replace(destination);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className={cn("flex flex-col gap-6", className)}
			{...props}
		>
			<FieldGroup>
				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
					<p className="max-w-[42ch] text-balance text-sm leading-relaxed text-muted-foreground">
						Use the same email and password you chose when you registered.
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
						placeholder="you@example.com"
						autoComplete="email"
						required
					/>
				</Field>
				<Field>
					<div className="flex items-center">
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Link
							href="/forgot-password"
							className="ml-auto min-h-9 shrink-0 content-center text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
						>
							Forgot password?
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
					<Button type="submit" className="h-11 w-full text-base font-semibold" disabled={pending}>
						{pending ? "Signing in…" : "Log in"}
					</Button>
				</Field>
				<div className="space-y-2 text-center text-sm text-muted-foreground">
					<FieldDescription className="text-center text-sm text-muted-foreground">
						No account yet?{" "}
						<Link
							href={variant === "educator" ? "/signup/teacher" : "/signup/role-picker"}
							className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
						>
							Sign up
						</Link>
					</FieldDescription>
					{variant === "educator" ?
						<FieldDescription>
							Student or parent?{" "}
							<Link
								href="/login"
								className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
							>
								Log in here
							</Link>
						</FieldDescription>
					:	<FieldDescription>
							Educator?{" "}
							<Link
								href="/login/educator"
								className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
							>
								Log in as an educator
							</Link>
						</FieldDescription>
					}
				</div>
			</FieldGroup>
		</form>
	);
}
