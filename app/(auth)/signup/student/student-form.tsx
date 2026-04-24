"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { completeStudentRegistration, type StudentSignupState } from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { cn } from "@/lib/utils";
import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { studentSignupSchema } from "@/lib/validations/auth";
import { getAppUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

const step0Schema = z
	.object({
		fullName: z.string().min(1).max(200),
		email: z.string().email(),
		password: z.string().min(8),
		confirmPassword: z.string().min(8),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

const step2Schema = z.object({
	parentName: z.string().min(1).max(200),
	parentEmail: z.string().email(),
});

const selectClassName = cn(
	"h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none",
	"focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
	"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-secondary",
);

const STEP_LABELS = ["Your account", "School details", "Parent / guardian"] as const;

const step1Schema = z
	.object({
		grade: z.number().int().min(6).max(12),
		section: z.string().min(1).max(5),
		stream: z
			.enum([
				"science",
				"science_pcmb",
				"science_pcm",
				"science_pcb",
				"commerce",
				"commerce_with_maths",
				"arts",
			])
			.optional()
			.nullable(),
		electiveSubjectId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.grade >= 11 && data.grade <= 12) {
			if (!data.stream) {
				ctx.addIssue({
					code: "custom",
					message: "Select a stream for grades 11–12",
					path: ["stream"],
				});
			}
		}
	});

type Elective = { id: string; name: string; grade: number };

type Props = {
	electives: Elective[];
};

function formatStepErrors(err: z.ZodError): string {
	const flat = err.flatten();
	const fieldMsgs = Object.values(flat.fieldErrors).flat().filter(Boolean);
	const formMsgs = flat.formErrors.filter(Boolean);
	return [...fieldMsgs, ...formMsgs].join(" ") || "Please check the fields above.";
}

export function StudentSignupForm({ electives }: Props) {
	const [state, setState] = useState<StudentSignupState>({});
	const [step, setStep] = useState(0);
	const [stepError, setStepError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [grade, setGrade] = useState(9);
	const [section, setSection] = useState("");
	const [stream, setStream] = useState<
		| ""
		| "science"
		| "science_pcmb"
		| "science_pcm"
		| "science_pcb"
		| "commerce"
		| "commerce_with_maths"
		| "arts"
	>("");
	const [electiveSubjectId, setElectiveSubjectId] = useState("");
	const [parentName, setParentName] = useState("");
	const [parentEmail, setParentEmail] = useState("");

	const senior = grade >= 11 && grade <= 12;
	const lastStep = step === STEP_LABELS.length - 1;

	function buildFormData(): FormData {
		const fd = new FormData();
		fd.set("email", email.trim());
		fd.set("password", password);
		fd.set("fullName", fullName.trim());
		fd.set("grade", String(grade));
		fd.set("section", section.trim());
		if (senior) {
			fd.set("stream", stream);
			if (electiveSubjectId) {
				fd.set("electiveSubjectId", electiveSubjectId);
			}
		}
		fd.set("parentName", parentName.trim());
		fd.set("parentEmail", parentEmail.trim());
		return fd;
	}

	function goNext() {
		setStepError(null);
		if (step === 0) {
			const parsed = step0Schema.safeParse({
				fullName: fullName.trim(),
				email: email.trim(),
				password,
				confirmPassword,
			});
			if (!parsed.success) {
				setStepError(formatStepErrors(parsed.error));
				return;
			}
			setStep(1);
			return;
		}
		if (step === 1) {
			const parsed = step1Schema.safeParse({
				grade,
				section: section.trim(),
				stream: senior ? stream || null : null,
				electiveSubjectId: senior ? electiveSubjectId : undefined,
			});
			if (!parsed.success) {
				setStepError(formatStepErrors(parsed.error));
				return;
			}
			setStep(2);
		}
	}

	function goBack() {
		setStepError(null);
		setStep((s) => Math.max(0, s - 1));
	}

	function onGradeChange(next: number) {
		setGrade(next);
		if (next < 11 || next > 12) {
			setStream("");
			setElectiveSubjectId("");
		}
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!lastStep) return;

		setStepError(null);
		setState({});
		const parsedFinal = step2Schema.safeParse({
			parentName: parentName.trim(),
			parentEmail: parentEmail.trim(),
		});
		if (!parsedFinal.success) {
			setStepError(formatStepErrors(parsedFinal.error));
			return;
		}

		if (password !== confirmPassword) {
			setStepError("Passwords do not match");
			return;
		}

		const fullParsed = studentSignupSchema.safeParse({
			email: email.trim(),
			password,
			fullName: fullName.trim(),
			grade,
			section: section.trim(),
			stream: senior ? stream : null,
			electiveSubjectId:
				senior && electiveSubjectId.length > 0 ? electiveSubjectId : null,
			parentName: parentName.trim(),
			parentEmail: parentEmail.trim(),
		});
		if (!fullParsed.success) {
			setStepError(formatStepErrors(fullParsed.error));
			return;
		}

		setPending(true);
		const fd = buildFormData();
		let emailRedirectTo: string;
		try {
			emailRedirectTo = `${getAppUrl()}/auth/callback`;
		} catch {
			setState({ error: "Account setup is unavailable until the app URL is configured." });
			setPending(false);
			return;
		}

		const supabase = createClient();
		const d = fullParsed.data;
		const { data: authData, error: signUpError } = await supabase.auth.signUp({
			email: email.trim(),
			password,
			options: {
				emailRedirectTo,
				data: {
					[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
						version: 1,
						role: "student",
						payload: {
							email: d.email,
							fullName: d.fullName,
							grade: d.grade,
							section: d.section,
							stream: d.stream,
							electiveSubjectId: d.electiveSubjectId,
							parentName: d.parentName,
							parentEmail: d.parentEmail,
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

		const result = await completeStudentRegistration(undefined, fd);
		if (result?.error) {
			setState({ error: result.error });
			setPending(false);
			return;
		}
		setPending(false);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			<div className="space-y-2">
				<div
					className="flex gap-1.5"
					role="list"
					aria-label="Signup progress"
				>
					{STEP_LABELS.map((_, i) => (
						<div
							key={STEP_LABELS[i]}
							role="listitem"
							className={cn(
								"h-1 min-w-0 flex-1 rounded-full transition-colors",
								i <= step ? "bg-emerald-600 dark:bg-emerald-500" : "bg-border",
							)}
						/>
					))}
				</div>
				<p className="text-xs text-muted-foreground">
					Step {step + 1} of {STEP_LABELS.length}
					<span className="text-foreground"> — {STEP_LABELS[step]}</span>
				</p>
			</div>

			{step === 0 ? (
				<div className="space-y-4">
					<Field>
						<FieldLabel htmlFor="fullName">Full name</FieldLabel>
						<Input
							id="fullName"
							name="fullName"
							autoComplete="name"
							value={fullName}
							onChange={(e) => setFullName(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="password">Password</FieldLabel>
						<Input
							id="password"
							name="password"
							type="password"
							minLength={8}
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
						<Input
							id="confirmPassword"
							type="password"
							minLength={8}
							autoComplete="new-password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
						/>
					</Field>
				</div>
			) : null}

			{step === 1 ? (
				<div className="space-y-4">
					<Field>
						<FieldLabel htmlFor="grade">Grade</FieldLabel>
						<select
							id="grade"
							name="grade"
							value={grade}
							onChange={(e) => onGradeChange(Number(e.target.value))}
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
							placeholder="e.g. A"
							maxLength={5}
							value={section}
							onChange={(e) => setSection(e.target.value)}
						/>
					</Field>
					{senior ? (
						<>
							<Field>
								<FieldLabel htmlFor="stream">Stream</FieldLabel>
								<select
									id="stream"
									name="stream"
									value={stream}
									onChange={(e) =>
										setStream(e.target.value as typeof stream)
									}
									className={selectClassName}
								>
									<option value="" disabled>
										Select stream
									</option>
									<option value="science">Science</option>
									<option value="science_pcmb">Science (PCMB)</option>
									<option value="science_pcm">Science (PCM)</option>
									<option value="science_pcb">Science (PCB)</option>
									<option value="commerce">Commerce</option>
									<option value="commerce_with_maths">Commerce (with Maths)</option>
									<option value="arts">Arts</option>
								</select>
							</Field>
							<Field>
								<FieldLabel htmlFor="electiveSubjectId">Elective (optional)</FieldLabel>
								<select
									id="electiveSubjectId"
									name="electiveSubjectId"
									value={electiveSubjectId}
									onChange={(e) => setElectiveSubjectId(e.target.value)}
									className={selectClassName}
								>
									<option value="">None</option>
									{electives
										.filter((item) => item.grade === grade)
										.map((item) => (
											<option key={item.id} value={item.id}>
												{item.name}
											</option>
										))}
								</select>
							</Field>
						</>
					) : null}
				</div>
			) : null}

			{step === 2 ? (
				<div className="space-y-4">
					<Field>
						<FieldLabel htmlFor="parentName">Parent / guardian name</FieldLabel>
						<Input
							id="parentName"
							name="parentName"
							autoComplete="name"
							value={parentName}
							onChange={(e) => setParentName(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="parentEmail">Parent / guardian email</FieldLabel>
						<Input
							id="parentEmail"
							name="parentEmail"
							type="email"
							autoComplete="email"
							value={parentEmail}
							onChange={(e) => setParentEmail(e.target.value)}
						/>
					</Field>
				</div>
			) : null}

			<AnimateFormAlert show={Boolean(stepError)} motionKey="student-step-error">
				<Alert variant="destructive">
					<AlertTitle>Check this step</AlertTitle>
					<AlertDescription>{stepError}</AlertDescription>
				</Alert>
			</AnimateFormAlert>
			<AnimateFormAlert show={Boolean(state.error)} motionKey="student-error">
				<Alert variant="destructive">
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>{state.error}</AlertDescription>
				</Alert>
			</AnimateFormAlert>
			<AnimateFormAlert show={Boolean(state.needsVerification)} motionKey="student-verify">
				<Alert>
					<AlertTitle>Check your email</AlertTitle>
					<AlertDescription>
						Confirm your account, then log in to finish setup if needed.
					</AlertDescription>
				</Alert>
			</AnimateFormAlert>

			<div className="flex flex-col gap-2">
				{lastStep ? (
					<SubmitButton label="Create student account" busy={pending} />
				) : (
					<Button type="button" className="w-full" variant="default" onClick={goNext}>
						Continue
					</Button>
				)}
				{step > 0 ? (
					<Button
						type="button"
						variant="outline"
						className="w-full"
						onClick={goBack}
						disabled={pending}
					>
						Back
					</Button>
				) : null}
			</div>

			<p className="text-center text-sm text-muted-foreground">
				<Link href="/login" className="text-foreground underline underline-offset-4 hover:text-foreground">
					Already have an account?
				</Link>
			</p>
		</form>
	);
}
