"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
	return (
		<button
			type="button"
			className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
			onClick={async () => {
				const supabase = createClient();
				await supabase.auth.signOut();
				window.location.href = "/";
			}}
		>
			Sign out
		</button>
	);
}
