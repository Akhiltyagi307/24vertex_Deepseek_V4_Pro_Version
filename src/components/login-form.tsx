"use client";

import Link from "next/link";
import { useActionState, useMemo } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
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

function SubmitLoginButton() {
	const { pending } = useFormStatus();
	return (
		<Button
			type="submit"
			className="h-11 w-full text-base font-semibold"
			disabled={pending}
		>
			{pending ? "Signing in…" : "Log in"}
		</Button>
	);
}

type Props = {
	callbackError?: string;
	/** Set after email confirmation + profile creation — user should sign in with password. */
	emailVerified?: boolean;
	/** Set after a recovery-flow password update — user should sign in with the new password. */
	passwordReset?: boolean;
	/**
	 * Educator login: same shell as students, with teacher signup link and educator marketing column
	 * (see `AuthStudioCardGate`). Post-auth routing still uses `profiles.role` / `is_verified`.
	 */
	variant?: "default" | "educator";
	className?: string;
} & Omit<React.ComponentProps<"form">, "onSubmit" | "action">;

export function LoginForm({
	callbackError,
	emailVerified,
	passwordReset,
	variant = "default",
	className,
	...props
}: Props) {
	const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

	const callbackMessage = useMemo(() => {
		if (!callbackError?.trim()) return null;
		try {
			return sanitizeLoginErrorMessage(decodeURIComponent(callbackError));
		} catch {
			return sanitizeLoginErrorMessage(callbackError);
		}
	}, [callbackError]);

	const displayError =
		state.error != null ? sanitizeLoginErrorMessage(state.error) : callbackMessage;

	return (
		<form
			action={formAction}
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
				<AnimateFormAlert show={Boolean(passwordReset)} motionKey="login-password-reset">
					<Alert>
						<AlertTitle>Password updated</AlertTitle>
						<AlertDescription>
							Sign in with your new password to continue.
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
					<SubmitLoginButton />
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
