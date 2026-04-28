"use client";

import Link from "next/link";
import { ArrowLeftIcon, InfoIcon, UserPlusIcon } from "lucide-react";
import { useActionState } from "react";

import { linkParentToStudent } from "./actions";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LinkChildForm() {
	const [state, formAction] = useActionState(linkParentToStudent, {});

	const staggerSections = [
		{
			key: "header",
			content: (
				<header className="flex flex-col gap-3">
					<div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:bg-muted/25">
						<UserPlusIcon className="size-5" aria-hidden />
					</div>
					<div className="flex flex-col gap-1.5">
						<h1 className="text-balance font-semibold text-2xl tracking-tight">Link your child&apos;s account</h1>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Enter their six-character link code from the student Profile, or paste their account UUID.
						</p>
					</div>
				</header>
			),
		},
		{
			key: "hint",
			content: (
				<div className="flex gap-3 rounded-lg border border-border/80 bg-muted/25 p-3.5 text-muted-foreground text-xs leading-relaxed">
					<InfoIcon className="mt-0.5 size-4 shrink-0 text-primary/90" aria-hidden />
					<p>
						If their profile already lists a guardian email, sign in with that same email on your parent
						account—or linking will fail.
					</p>
				</div>
			),
		},
		{
			key: "form",
			content: (
				<div className="rounded-xl border border-border bg-card p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
					<form action={formAction} className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="studentId">Link code or student ID</Label>
							<Input
								id="studentId"
								name="studentId"
								required
								autoComplete="off"
								autoCapitalize="characters"
								spellCheck={false}
								placeholder="e.g. AB1234"
								aria-invalid={Boolean(state.error)}
								className="font-mono text-sm"
							/>
						</div>
						{state.error ? (
							<p className="text-destructive text-sm leading-relaxed" role="alert">
								{state.error}
							</p>
						) : null}
						<SubmitButton label="Link child" pendingLabel="Linking…" />
					</form>
				</div>
			),
		},
		{
			key: "back",
			content: (
				<div className="border-t border-border pt-8">
					<Button variant="link" className="h-auto px-0 text-muted-foreground hover:text-foreground" render={<Link href="/parent/select-student" />}>
						<ArrowLeftIcon data-icon="inline-start" className="size-4" />
						Back to child picker
					</Button>
				</div>
			),
		},
	];

	return <PageStaggerRoot enableLift={false} className="flex flex-1 flex-col gap-9" sections={staggerSections} />;
}
