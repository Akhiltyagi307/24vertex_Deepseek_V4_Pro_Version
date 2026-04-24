import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function ParentDashboardPage() {
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-xl font-semibold">Parent dashboard</h1>
				<SignOutButton />
			</div>
			<p className="text-sm text-zinc-600">Track your child&apos;s progress here once linked.</p>
			<p className="text-sm">
				<Link href="/parent/link-child" className="font-medium underline">
					Link to your child
				</Link>
			</p>
			<p className="text-sm">
				<Link href="/" className="underline">
					Home
				</Link>
			</p>
		</div>
	);
}
