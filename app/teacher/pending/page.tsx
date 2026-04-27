import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/routing";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";

export default async function TeacherPendingPage() {
	const profile = await getProfile();
	if (profile?.is_verified) {
		redirect("/teacher/dashboard");
	}

	return (
		<PageStaggerRoot
			enableLift={false}
			className="mx-auto flex max-w-2xl flex-col gap-6"
			sections={[
				{
					key: "header",
					content: (
						<div className="flex items-center justify-between gap-4">
							<h1 className="text-xl font-semibold">Account pending</h1>
							<SignOutButton />
						</div>
					),
				},
				{
					key: "body",
					content: (
						<p className="text-sm text-zinc-600">
							Your teacher account is waiting for administrator approval. You will be able to create
							assignments and send notifications after verification.
						</p>
					),
				},
				{
					key: "footer",
					content: (
						<p className="text-sm">
							<Link href="/" className="underline">
								Home
							</Link>
						</p>
					),
				},
			]}
		/>
	);
}
