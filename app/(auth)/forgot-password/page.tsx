"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgotPasswordAction } from "./actions";
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

function SubmitForgotButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" className="h-11 w-full text-base font-semibold" disabled={pending}>
			{pending ? "Sending…" : "Send reset link"}
		</Button>
	);
}

export default function ForgotPasswordPage() {
	const [state, formAction] = useActionState(forgotPasswordAction, {});

	return (
		<form action={formAction} className="flex flex-col gap-6">
			<FieldGroup>
				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
					<p className="max-w-[40ch] text-balance text-sm leading-relaxed text-muted-foreground">
						We will email you a secure link to choose a new password.
					</p>
				</div>
				<AnimateFormAlert show={Boolean(state.error)} motionKey="forgot-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<AnimateFormAlert show={Boolean(state.success)} motionKey="forgot-success">
					<Alert>
						<AlertTitle>Check your email</AlertTitle>
						<AlertDescription>
							If that address is on file, a reset link is on the way. Check spam if nothing
							arrives within a few minutes.
						</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				{!state.success ? (
					<>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="you@example.com"
								required
								autoComplete="email"
							/>
						</Field>
						<Field>
							<SubmitForgotButton />
						</Field>
					</>
				) : null}
				<FieldDescription className="text-center text-sm text-muted-foreground">
					<Link
						href="/login"
						className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Back to log in
					</Link>
				</FieldDescription>
			</FieldGroup>
		</form>
	);
}
