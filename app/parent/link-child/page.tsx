"use client";

import Link from "next/link";
import { useActionState } from "react";
import { linkParentToStudent } from "./actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";

export default function LinkChildPage() {
	const [state, formAction] = useActionState(linkParentToStudent, {});

	return (
		<PageStaggerRoot
			enableLift={false}
			className="mx-auto flex max-w-md flex-col gap-6"
			sections={[
				{
					key: "intro",
					content: (
						<div>
							<h1 className="text-xl font-semibold">Link to your child</h1>
							<p className="mt-1 text-sm text-zinc-600">
								Enter your child&apos;s link code (on their profile) or their account UUID. Your email must
								match the parent email they registered.
							</p>
						</div>
					),
				},
				{
					key: "form",
					content: (
						<form action={formAction} className="space-y-4">
							<div>
								<label htmlFor="studentId" className="block text-sm font-medium">
									Link code or student ID
								</label>
								<input
									id="studentId"
									name="studentId"
									required
									placeholder="e.g. AB1234"
									className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
								/>
							</div>
							{state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
							<SubmitButton label="Link account" />
						</form>
					),
				},
				{
					key: "back",
					content: (
						<p className="text-sm">
							<Link href="/parent/dashboard" className="underline">
								Back to dashboard
							</Link>
						</p>
					),
				},
			]}
		/>
	);
}
