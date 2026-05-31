"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { recordPasswordChangedAction } from "./account-security-actions";
import { panelRaisedInputClass, settingsCardCtaButtonClass, settingsCardCtaRowClass } from "./_settings-form-styles";
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
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { studentChangePasswordSchema } from "@/lib/validations/auth";

type Props = {
	loginEmail: string;
	/** Prefix for input ids (default `student`). Use `teacher` on educator settings to avoid duplicate DOM ids. */
	fieldIdPrefix?: string;
};

/**
 * Password change runs entirely against the Supabase Auth client (sign-in to verify
 * the current password, then `updateUser`). The server side just records the
 * notification audit via `recordPasswordChangedAction`. Local state stays scoped
 * to this component so the parent form's `useActionState` is not entangled.
 */
export function PasswordChangeForm({ loginEmail, fieldIdPrefix = "student" }: Props) {
	const [pwCurrent, setPwCurrent] = useState("");
	const [pwNew, setPwNew] = useState("");
	const [pwConfirm, setPwConfirm] = useState("");
	const [pwError, setPwError] = useState<string | null>(null);
	const [pwSuccess, setPwSuccess] = useState(false);
	const [pwPending, setPwPending] = useState(false);

	async function handleChangePassword() {
		setPwError(null);
		setPwSuccess(false);
		if (!loginEmail.trim()) {
			setPwError("Your account email is missing. Try signing out and back in.");
			return;
		}
		const parsed = studentChangePasswordSchema.safeParse({
			currentPassword: pwCurrent,
			newPassword: pwNew,
			confirmPassword: pwConfirm,
		});
		if (!parsed.success) {
			const first =
				Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
				parsed.error.issues[0]?.message ??
				"Check your password fields.";
			setPwError(first);
			return;
		}
		setPwPending(true);
		const supabase = createClient();
		const { error: signErr } = await supabase.auth.signInWithPassword({
			email: loginEmail.trim(),
			password: parsed.data.currentPassword,
		});
		if (signErr) {
			setPwPending(false);
			setPwError(
				"That current password is incorrect, or this account may use another sign-in method (for example Google) instead of a password.",
			);
			return;
		}
		const { error: updErr } = await supabase.auth.updateUser({
			password: parsed.data.newPassword,
		});
		setPwPending(false);
		if (updErr) {
			setPwError(updErr.message);
			return;
		}
		await recordPasswordChangedAction();
		setPwSuccess(true);
		setPwCurrent("");
		setPwNew("");
		setPwConfirm("");
	}

	return (
		<div>
			<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
				<CardHeader className="px-0 pt-0">
					<CardTitle className="text-lg">Change password</CardTitle>
					<CardDescription className="text-base leading-relaxed">
						Update the password for this email login.
					</CardDescription>
				</CardHeader>
				<CardContent className="px-0">
					{pwError ? (
						<Alert variant="destructive" className="mb-6" role="alert">
							<AlertTitle>Could not update password</AlertTitle>
							<AlertDescription>{pwError}</AlertDescription>
						</Alert>
					) : null}
					{pwSuccess ? (
						<Alert className="mb-6" role="status">
							<CheckIcon />
							<AlertTitle>Password updated</AlertTitle>
							<AlertDescription>Your new password is ready to use.</AlertDescription>
						</Alert>
					) : null}
					<FieldGroup className="gap-6">
						<Field>
							<FieldLabel className="text-base" htmlFor={`${fieldIdPrefix}CurrentPassword`}>
								Current password
							</FieldLabel>
							<FieldContent>
								<Input
									id={`${fieldIdPrefix}CurrentPassword`}
									type="password"
									className={panelRaisedInputClass}
									autoComplete="current-password"
									value={pwCurrent}
									onChange={(e) => setPwCurrent(e.target.value)}
								/>
							</FieldContent>
						</Field>
						<Field>
							<FieldLabel className="text-base" htmlFor={`${fieldIdPrefix}NewPassword`}>
								New password
							</FieldLabel>
							<FieldContent>
								<Input
									id={`${fieldIdPrefix}NewPassword`}
									type="password"
									className={panelRaisedInputClass}
									autoComplete="new-password"
									value={pwNew}
									onChange={(e) => setPwNew(e.target.value)}
								/>
								<FieldDescription className="text-sm">
									At least 8 characters, same as when you signed up.
								</FieldDescription>
							</FieldContent>
						</Field>
						<Field>
							<FieldLabel className="text-base" htmlFor={`${fieldIdPrefix}ConfirmPassword`}>
								Confirm password
							</FieldLabel>
							<FieldContent>
								<Input
									id={`${fieldIdPrefix}ConfirmPassword`}
									type="password"
									className={panelRaisedInputClass}
									autoComplete="new-password"
									value={pwConfirm}
									onChange={(e) => setPwConfirm(e.target.value)}
								/>
							</FieldContent>
						</Field>
					</FieldGroup>
					<div className={settingsCardCtaRowClass}>
						<Button
							type="button"
							className={settingsCardCtaButtonClass}
							disabled={pwPending}
							onClick={() => void handleChangePassword()}
						>
							{pwPending ? "Updating…" : "Update password"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
