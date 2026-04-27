import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2Icon, LifeBuoyIcon, ShieldCheckIcon } from "lucide-react";

import { getProfile } from "@/lib/auth/routing";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeacherDashboardPage() {
	const profile = await getProfile();
	if (!profile?.is_verified) {
		redirect("/teacher/pending");
	}

	return (
		<PageStaggerRoot
			enableLift={false}
			className="mx-auto flex max-w-3xl flex-col gap-8"
			sections={[
				{
					key: "header",
					content: (
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1">
								<h1 className="text-2xl font-semibold tracking-tight">Teacher account</h1>
								<p className="text-sm text-muted-foreground">
									Your account is verified and ready for the teacher workspace on this deployment.
								</p>
							</div>
							<SignOutButton />
						</div>
					),
				},
				{
					key: "cards",
					content: (
						<div className="grid gap-4 md:grid-cols-3">
							<Card className="shadow-none">
								<CardHeader className="pb-2">
									<CardDescription>Verification</CardDescription>
									<CardTitle className="flex items-center gap-2 text-base">
										<ShieldCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
										Approved
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">
									Your school has verified this teacher account.
								</CardContent>
							</Card>

							<Card className="shadow-none">
								<CardHeader className="pb-2">
									<CardDescription>Account status</CardDescription>
									<CardTitle className="flex items-center gap-2 text-base">
										<CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
										Active
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">
									You can keep using this login as teacher tools are enabled for your deployment.
								</CardContent>
							</Card>

							<Card className="shadow-none">
								<CardHeader className="pb-2">
									<CardDescription>Need help?</CardDescription>
									<CardTitle className="flex items-center gap-2 text-base">
										<LifeBuoyIcon className="size-4 text-muted-foreground" />
										Support
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm text-muted-foreground">
									If something looks wrong with your account, contact your school administrator or EduAI
									support.
								</CardContent>
							</Card>
						</div>
					),
				},
				{
					key: "footer",
					content: (
						<p className="text-sm">
							<Link href="/" className="underline underline-offset-4">
								Home
							</Link>
						</p>
					),
				},
			]}
		/>
	);
}
