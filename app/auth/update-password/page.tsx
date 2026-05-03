"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

export default function UpdatePasswordPage() {
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [pending, setPending] = useState(false);
	const router = useRouter();

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		setPending(true);
		const supabase = createClient();
		const { error: updateError } = await supabase.auth.updateUser({ password });
		if (updateError) {
			setError(updateError.message);
			setPending(false);
			return;
		}
		setDone(true);
		router.push("/login");
		router.refresh();
	}

	return (
		<form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
			<FieldGroup>
				<div className="flex flex-col gap-2 text-center medium:text-left">
					<h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
					<p className="text-balance text-sm text-muted-foreground">
						Use the link from your email to reach this page.
					</p>
				</div>
				<AnimateFormAlert show={Boolean(done)} motionKey="update-pw-done">
					<Alert>
						<AlertTitle>Password updated</AlertTitle>
						<AlertDescription>Redirecting to log in…</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				<AnimateFormAlert show={Boolean(error)} motionKey="update-pw-error">
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</AnimateFormAlert>
				{!done ? (
					<>
						<Field>
							<FieldLabel htmlFor="password">New password</FieldLabel>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
							<Input
								id="confirm"
								type="password"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
							/>
						</Field>
						<Field>
							<Button type="submit" className="w-full" disabled={pending}>
								{pending ? "Please wait…" : "Update password"}
							</Button>
						</Field>
					</>
				) : null}
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
