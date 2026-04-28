import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { MotionPageEnter } from "@/components/motion/motion-page-enter";

export default async function HomePage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (user) {
		const path = await resolvePostAuthPath();
		redirect(path);
	}

	return (
		<main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
			<MotionPageEnter className="flex flex-col gap-8">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">EduAI</h1>
					<p className="mt-2 text-zinc-600">
						Create an account for your role, then log in. Students and parents each have a
						dedicated portal.
					</p>
				</div>
				<nav className="flex flex-col gap-3">
					<Link
						href="/signup/role-picker"
						className="rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
					>
						Sign up
					</Link>
					<Link
						href="/login"
						className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-900 hover:bg-zinc-50"
					>
						Log in
					</Link>
					<p className="text-center text-xs font-medium text-zinc-500">Or jump to signup</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<Link
							href="/signup/student"
							className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm hover:bg-zinc-50"
						>
							Student
						</Link>
						<Link
							href="/signup/parent"
							className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-sm hover:bg-zinc-50"
						>
							Parent
						</Link>
					</div>
				</nav>
			</MotionPageEnter>
		</main>
	);
}
