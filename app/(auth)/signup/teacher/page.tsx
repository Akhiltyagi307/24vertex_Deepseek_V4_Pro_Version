import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TeacherSignupPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Teacher sign up unavailable</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Teacher accounts are no longer supported. Please sign up as a student or parent.
				</p>
			</div>
			<p className="text-sm">
				<Link href="/signup/role-picker" className="underline underline-offset-4">
					Go to sign up options
				</Link>
			</p>
		</div>
	);
}
