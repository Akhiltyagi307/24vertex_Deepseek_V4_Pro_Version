"use client";

import Link from "next/link";
import { useState } from "react";
import { completeTeacherRegistration, type TeacherSignupState } from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { cn } from "@/lib/utils";
import { teacherSignupSchema } from "@/lib/validations/auth";

function resolveEmailRedirectTo(): string {
	try {
		return `${getAppUrl()}/auth/callback`;
	} catch (error) {
		if (typeof window !== "undefined" && window.location.origin) {
			return `${window.location.origin}/auth/callback`;
		}
		throw error;
	}
}

export default function TeacherSignupPage() {
	const [state, setState] = useState<TeacherSignupState>({});
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setState({});
		const form = e.currentTarget;
		const fd = new FormData(form);
		const email = String(fd.get("email") ?? "").trim();
		const password = String(fd.get("password") ?? "");
		const confirmPassword = String(fd.get("confirmPassword") ?? "");

		if (password !== confirmPassword) {
			setState({ error: "Passwords do not match" });
			return;
		}
		if (password.length < 8) {
			setState({ error: "Password must be at least 8 characters" });
			return;
		}

		setPending(true);
		fd.delete("confirmPassword");
		let emailRedirectTo: string;
		try {
			emailRedirectTo = resolveEmailRedirectTo();
		} catch (error) {
			if (process.env.NODE_ENV !== "production") {
				console.error("Teacher signup redirect URL unavailable", error);
			}
			setState({ error: "Account setup is unavailable until the app URL is configured. Contact support." });
			setPending(false);
			return;
		}

		const fullName = String(fd.get("fullName") ?? "").trim();
		const phone = String(fd.get("phone") ?? "").trim();
		const schoolRaw = fd.get("schoolName");
		const schoolName = typeof schoolRaw === "string" ? schoolRaw.trim() : "";
		const parsedSignup = teacherSignupSchema.safeParse({
			email,
			password,
			fullName,
			phone,
			schoolName: schoolName === "" ? undefined : schoolName,
		});
		if (!parsedSignup.success) {
			const flat = parsedSignup.error.flatten().fieldErrors;
			const msg = Object.values(flat).flat()[0] ?? "Please check your details.";
			setState({ error: msg });
			setPending(false);
			return;
		}

		const {
			email: payloadEmail,
			fullName: payloadName,
			phone: payloadPhone,
			schoolName: payloadSchool,
		} = parsedSignup.data;
		const supabase = createClient();
		const { data: authData, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo,
				data: {
					[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
						version: 1,
						role: "teacher",
						payload: {
							email: payloadEmail,
							fullName: payloadName,
							phone: payloadPhone,
							schoolName: payloadSchool ?? null,
						},
					}),
				},
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

		const result = await completeTeacherRegistration(undefined, fd);
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
				<h1 className="text-2xl font-bold tracking-tight">Teacher sign up</h1>
				<p className="text-balance text-sm text-muted-foreground">
					Use your work email and phone. After you sign up, the 24vertex team will approve your account (usually within
					24–48 hours) before the teacher workspace is unlocked. Student connections via school name and school ID come in a
					later step.
				</p>
			</div>
			<form onSubmit={handleSubmit} className="space-y-4" noValidate>
				<Field>
					<FieldLabel htmlFor="fullName">Full name</FieldLabel>
					<Input id="fullName" name="fullName" required autoComplete="name" />
				</Field>
				<Field>
					<FieldLabel htmlFor="schoolName">School name (optional)</FieldLabel>
					<Input id="schoolName" name="schoolName" autoComplete="organization" placeholder="e.g. Delhi Public School" />
					<p className="mt-1.5 text-xs text-muted-foreground">
						Optional for now. Official school ID verification will link you to the right students.
					</p>
				</Field>
				<Field>
					<FieldLabel htmlFor="phone">Mobile number</FieldLabel>
					<div
						className={cn(
							"flex h-9 w-full min-w-0 overflow-hidden rounded-md border border-input bg-transparent text-sm shadow-xs",
							"transition-[color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50",
						)}
					>
						<span
							className="flex shrink-0 items-center border-r border-input bg-muted/40 px-3 font-medium tabular-nums text-muted-foreground"
							aria-hidden
						>
							+91
						</span>
						<Input
							id="phone"
							name="phone"
							type="tel"
							required
							autoComplete="tel-national"
							inputMode="numeric"
							maxLength={10}
							pattern="\d{10}"
							placeholder="9876543210"
							className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
						/>
					</div>
					<p className="mt-1.5 text-xs text-muted-foreground">
						Enter 10 digits only (no country code). We use this to reach you about your account and approval.
					</p>
				</Field>
				<Field>
					<FieldLabel htmlFor="email">Email</FieldLabel>
					<Input id="email" name="email" type="email" required autoComplete="email" />
					<p className="mt-1.5 text-xs text-muted-foreground">This becomes your login email; use an address you check often.</p>
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
				<AnimateFormAlert show={Boolean(state.error)} motionKey="teacher-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<AnimateFormAlert show={Boolean(state.needsVerification)} motionKey="teacher-verify">
					<Alert>
						<AlertTitle>Check your email</AlertTitle>
						<AlertDescription>
							Confirm your email to finish signup. The 24vertex team will email you again after your teacher account
							is approved (typically within 24–48 hours).
						</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<SubmitButton label="Create teacher account" busy={pending} />
				<p className="text-center text-sm text-muted-foreground">
					<Link
						href="/login/educator"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Already have an account?
					</Link>
				</p>
			</form>
		</div>
	);
}
