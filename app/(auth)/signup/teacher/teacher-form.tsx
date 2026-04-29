"use client";

import Link from "next/link";
import { useState } from "react";
import { completeTeacherRegistration, type TeacherSignupState } from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { cn } from "@/lib/utils";
import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { teacherSignupSchema } from "@/lib/validations/auth";

const selectClassName = cn(
	"h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none",
	"focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
	"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-secondary",
);

type Subject = { id: string; name: string; grade: number };

type Props = {
	subjects: Subject[];
};

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

export function TeacherSignupForm({ subjects }: Props) {
	const [state, setState] = useState<TeacherSignupState>({});
	const [grade, setGrade] = useState(9);
	const [pending, setPending] = useState(false);
	const filtered = subjects.filter((s) => s.grade === grade);

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
			const details = error instanceof Error ? ` (${error.message})` : "";
			setState({ error: `Account setup is unavailable until the app URL is configured.${details}` });
			setPending(false);
			return;
		}

		const grade = Number(fd.get("grade"));
		const parsedSignup = teacherSignupSchema.safeParse({
			email,
			password,
			fullName: String(fd.get("fullName") ?? "").trim(),
			schoolName: String(fd.get("schoolName") ?? "").trim(),
			assignments: [
				{
					grade,
					section: String(fd.get("section") ?? "").trim(),
					subjectId: String(fd.get("subjectId") ?? ""),
				},
			],
		});
		if (!parsedSignup.success) {
			setState({
				error:
					parsedSignup.error.flatten().fieldErrors.assignments?.[0] ?? "Please check the form.",
			});
			setPending(false);
			return;
		}

		const tp = parsedSignup.data;
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
							email: tp.email,
							fullName: tp.fullName,
							schoolName: tp.schoolName,
							assignments: tp.assignments,
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
		<form onSubmit={handleSubmit} className="space-y-4" noValidate>
			<Field>
				<FieldLabel htmlFor="fullName">Full name</FieldLabel>
				<Input id="fullName" name="fullName" required autoComplete="name" />
			</Field>
			<Field>
				<FieldLabel htmlFor="email">Email</FieldLabel>
				<Input id="email" name="email" type="email" required autoComplete="email" />
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
			<Field>
				<FieldLabel htmlFor="schoolName">School / institution</FieldLabel>
				<Input id="schoolName" name="schoolName" required />
			</Field>
			<p className="text-sm text-muted-foreground">
				Add at least one grade, section, and subject you teach (you can add more later from your
				dashboard when available).
			</p>
			<Field>
				<FieldLabel htmlFor="grade">Grade</FieldLabel>
				<select
					id="grade"
					name="grade"
					required
					value={grade}
					onChange={(e) => setGrade(Number(e.target.value))}
					className={selectClassName}
				>
					{[6, 7, 8, 9, 10, 11, 12].map((g) => (
						<option key={g} value={g}>
							{g}
						</option>
					))}
				</select>
			</Field>
			<Field>
				<FieldLabel htmlFor="section">Section</FieldLabel>
				<Input
					id="section"
					name="section"
					required
					placeholder="e.g. A"
					maxLength={5}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="subjectId">Subject</FieldLabel>
				<select id="subjectId" name="subjectId" required className={selectClassName}>
					<option value="">Select subject</option>
					{filtered.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
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
					<AlertDescription>Confirm your account to continue.</AlertDescription>
				</Alert>
			</AnimateFormAlert>
			<SubmitButton label="Create teacher account" busy={pending} />
			<p className="text-center text-sm text-muted-foreground">
				<Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground">
					Already have an account?
				</Link>
			</p>
		</form>
	);
}
