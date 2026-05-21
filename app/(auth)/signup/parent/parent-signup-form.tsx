"use client";

import Link from "next/link";
import { useState } from "react";
import { completeParentRegistration, type ParentSignupState } from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	buildPendingRegistrationMeta,
	resolveEmailRedirectTo,
	validatePasswordPair,
} from "@/lib/auth/signup-client";
import { createClient } from "@/lib/supabase/client";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { parentSignupSchema } from "@/lib/validations/auth";

export function ParentSignupForm() {
	const [state, setState] = useState<ParentSignupState>({});
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setState({});
		const form = e.currentTarget;
		const fd = new FormData(form);
		const email = String(fd.get("email") ?? "").trim();
		const password = String(fd.get("password") ?? "");
		const confirmPassword = String(fd.get("confirmPassword") ?? "");

		const pwResult = validatePasswordPair(password, confirmPassword);
		if (!pwResult.ok) {
			setState({ error: pwResult.error });
			return;
		}

		setPending(true);
		fd.delete("confirmPassword");
		let emailRedirectTo: string;
		try {
			emailRedirectTo = resolveEmailRedirectTo();
		} catch (error) {
			const details = error instanceof Error ? ` (${error.message})` : "";
			setState({ error: `Account setup is unavailable until the app URL is configured.${details}` });
			setPending(false);
			return;
		}

		const fullName = String(fd.get("fullName") ?? "").trim();
		const studentLinkCode = String(fd.get("studentLinkCode") ?? "").trim();
		const parsedSignup = parentSignupSchema.safeParse({ email, password, fullName, studentLinkCode });
		if (!parsedSignup.success) {
			const msg =
				parsedSignup.error.flatten().fieldErrors.studentLinkCode?.[0] ??
				parsedSignup.error.flatten().fieldErrors.email?.[0] ??
				"Please check your details.";
			setState({ error: msg });
			setPending(false);
			return;
		}

		const { email: payloadEmail, fullName: payloadName, studentLinkCode: payloadCode } = parsedSignup.data;
		const supabase = createClient();
		const { data: authData, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo,
				data: buildPendingRegistrationMeta("parent", {
					email: payloadEmail,
					fullName: payloadName,
					studentLinkCode: payloadCode,
				}),
			},
		});

		if (signUpError) {
			setState({ error: signUpError.message });
			setPending(false);
			return;
		}

		if (!authData.session) {
			setState({ needsVerification: true });
			setPending(false);
			return;
		}

		const result = await completeParentRegistration(undefined, fd);
		if (result?.error) {
			setState({ error: result.error });
			setPending(false);
			return;
		}

		setPending(false);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center medium:text-left">
				<h1 className="text-2xl font-bold tracking-tight">Parent sign up</h1>
				<p className="text-balance text-sm text-muted-foreground">
					Use your own email for this parent account, and enter your child&apos;s six-character link code from
					their 24Vertex Profile so we can connect them to you.
				</p>
			</div>
			<form onSubmit={handleSubmit} className="space-y-4" noValidate>
				<Field>
					<FieldLabel htmlFor="fullName">Full name</FieldLabel>
					<Input id="fullName" name="fullName" required autoComplete="name" />
				</Field>
				<Field>
					<FieldLabel htmlFor="studentLinkCode">Student link code</FieldLabel>
					<Input
						id="studentLinkCode"
						name="studentLinkCode"
						required
						autoComplete="off"
						placeholder="e.g. AB1234"
						className="font-mono tracking-wide uppercase"
					/>
					<p className="text-muted-foreground mt-1.5 text-xs">
						{
							"Your child can find this under Profile -> Link code. It is two letters and four numbers."
						}
					</p>
				</Field>
				<Field>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input id="email" name="email" type="email" required autoComplete="email" />
					<p className="text-muted-foreground mt-1.5 text-xs">
						If your child&apos;s 24Vertex profile already lists a guardian/parent email, use that exact email
						here. Otherwise linking will fail after you verify your inbox.
					</p>
				</Field>
				<Field>
					<FieldLabel htmlFor="password">Password</FieldLabel>
					<Input
						id="password"
						name="password"
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
				<AnimateFormAlert show={Boolean(state.error)} motionKey="parent-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<AnimateFormAlert show={Boolean(state.needsVerification)} motionKey="parent-verify">
					<Alert>
						<AlertTitle>Check your email</AlertTitle>
						<AlertDescription>Confirm your account to continue.</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<SubmitButton label="Create parent account" busy={pending} />
				<p className="text-center text-sm text-muted-foreground">
					<Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground">
						Already have an account?
					</Link>
				</p>
			</form>
		</div>
	);
}
