"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePasswordAction, type UpdatePasswordState } from "./actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" className="w-full" disabled={pending}>
			{pending ? "Please wait…" : "Update password"}
		</Button>
	);
}

export function UpdatePasswordForm() {
	const [state, formAction] = useActionState<UpdatePasswordState, FormData>(
		updatePasswordAction,
		{},
	);

	return (
		<form action={formAction} className="flex flex-col gap-6">
			<FieldGroup>
				<div className="flex flex-col gap-2 text-center medium:text-left">
					<h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
					<p className="text-balance text-sm text-muted-foreground">
						Use the link from your email to reach this page.
					</p>
				</div>
				<AnimateFormAlert show={Boolean(state.error)} motionKey="update-pw-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<Field>
					<FieldLabel htmlFor="newPassword">New password</FieldLabel>
					<Input
						id="newPassword"
						name="newPassword"
						type="password"
						required
						minLength={8}
						autoComplete="new-password"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
					<Input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						required
						minLength={8}
						autoComplete="new-password"
					/>
				</Field>
				<Field>
					<SubmitButton />
				</Field>
				<FieldDescription className="text-center medium:text-left">
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
