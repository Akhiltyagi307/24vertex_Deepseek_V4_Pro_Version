"use client";

import { signOutEverywhere } from "@/lib/auth/sign-out";

export function SignOutButton() {
	return (
		<button
			type="button"
			className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
			onClick={() => void signOutEverywhere()}
		>
			Sign out
		</button>
	);
}
