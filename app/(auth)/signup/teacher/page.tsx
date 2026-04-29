import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TeacherSignupPage() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center md:text-left">
				<h1 className="text-2xl font-bold tracking-tight">Teacher sign up unavailable</h1>
				<p className="text-balance text-sm text-muted-foreground">
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
