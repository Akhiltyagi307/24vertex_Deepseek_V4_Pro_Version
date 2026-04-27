import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";

export default function ParentDashboardPage() {
	return (
		<PageStaggerRoot
			enableLift={false}
			className="mx-auto flex max-w-2xl flex-col gap-6"
			sections={[
				{
					key: "header",
					content: (
						<div className="flex items-center justify-between gap-4">
							<h1 className="text-xl font-semibold">Parent dashboard</h1>
							<SignOutButton />
						</div>
					),
				},
				{
					key: "intro",
					content: <p className="text-sm text-zinc-600">Track your child&apos;s progress here once linked.</p>,
				},
				{
					key: "link-child",
					content: (
						<p className="text-sm">
							<Link href="/parent/link-child" className="font-medium underline">
								Link to your child
							</Link>
						</p>
					),
				},
				{
					key: "home",
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
