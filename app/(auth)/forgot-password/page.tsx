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
		<Button type="submit" className="w-full" disabled={pending}>
			{pending ? "Please wait…" : "Send reset link"}
		</Button>
	);
}

export default function ForgotPasswordPage() {
	const [state, formAction] = useActionState(forgotPasswordAction, {});

	return (
		<form action={formAction} className="flex flex-col gap-6">
			<FieldGroup>
				<div className="flex flex-col items-center gap-1 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
					<p className="text-sm text-balance text-muted-foreground">
						We will email you a link to choose a new password.
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
							If an account exists for that email, you will receive a reset link
							shortly.
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
								required
								autoComplete="email"
							/>
						</Field>
						<Field>
							<SubmitForgotButton />
						</Field>
					</>
				) : null}
				<FieldDescription className="text-center text-muted-foreground">
					<Link
						href="/login"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Back to log in
					</Link>
				</FieldDescription>
			</FieldGroup>
		</form>
	);
}
