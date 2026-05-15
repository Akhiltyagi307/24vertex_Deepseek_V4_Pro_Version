import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile } from "@/lib/auth/routing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeacherPendingPage() {
	const profile = await getProfile();
	if (profile?.is_verified) {
		redirect("/teacher/dashboard");
	}

	return (
		<div className="flex w-full flex-1 flex-col items-center justify-center py-8">
			<div className="w-full max-w-2xl">
				<Card className="border-border/80 shadow-sm shadow-black/5">
					<CardHeader className="space-y-1">
						<div>
							<CardTitle className="text-xl tracking-tight">Verification pending</CardTitle>
							<CardDescription className="text-pretty pt-1 text-sm">
								You&apos;re signed in. An administrator still needs to approve your educator account before the full
								workspace unlocks. Use the sidebar menu when you need to sign out.
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						<p>
							Your profile is in the <span className="text-foreground">24vertex</span> review queue. Approvals are
							handled in the admin panel, typically within <span className="text-foreground">24–48 hours</span>.
						</p>
						<p>
							We&apos;ll email you at your login address when your access is active. Until then, you can sign out and
							return via{" "}
							<Link
								href="/login/educator"
								className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
							>
								educator log in
							</Link>{" "}
							anytime; you&apos;ll land back here until approval is complete.
						</p>
						<p className="text-sm">
							<Link href="/" className="text-foreground underline underline-offset-4 hover:text-foreground">
								Home
							</Link>
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
