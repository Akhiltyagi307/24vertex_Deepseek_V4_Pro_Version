import type { Metadata } from "next";
import Link from "next/link";

import { UpdatePasswordForm } from "./update-password-form";
import { readRecoveryWindow } from "@/lib/auth/recovery-window";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
	title: "Set a new password",
	robots: { index: false, follow: false },
};

export default async function UpdatePasswordPage() {
	const recoveryWindow = await readRecoveryWindow();
	if (!recoveryWindow) {
		return (
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2 text-center medium:text-left">
					<h1 className="text-2xl font-bold tracking-tight">Reset link expired</h1>
					<p className="text-balance text-sm text-muted-foreground">
						This password-reset link is no longer valid. Request a new one and follow the
						email link within ten minutes.
					</p>
				</div>
				<Alert>
					<AlertTitle>Need a new link?</AlertTitle>
					<AlertDescription>
						Recovery links expire ten minutes after they are issued. Reopening this page in a
						stale tab also counts as expired. Request a fresh email to continue.
					</AlertDescription>
				</Alert>
				<Button render={<Link href="/forgot-password" />} className="w-full">
					Request a new reset email
				</Button>
				<p className="text-center text-sm text-muted-foreground">
					<Link
						href="/login"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Back to log in
					</Link>
				</p>
			</div>
		);
	}

	return <UpdatePasswordForm />;
}
