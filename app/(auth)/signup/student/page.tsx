import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { StudentSignupForm } from "./student-form";

export const dynamic = "force-dynamic";

function isTransientFetchError(error: { message?: string } | null): boolean {
	if (!error?.message) return false;
	const msg = error.message.toLowerCase();
	return msg.includes("fetch failed") || msg.includes("network");
}

export default async function StudentSignupPage() {
	const supabase = await createClient();
	/** Prefer batch RPC from `20260424150000_signup_batch_rpcs.sql`; fall back if migration not applied. */
	let batch = await supabase.rpc("get_electives_for_signup");
	if (isTransientFetchError(batch.error)) {
		// Single immediate retry for transient network failures in local dev.
		batch = await supabase.rpc("get_electives_for_signup");
	}
	let electives = batch.data ?? [];

	if (batch.error?.code === "PGRST202") {
		const [g11, g12] = await Promise.all([
			supabase.rpc("get_available_electives", { p_grade: 11 }),
			supabase.rpc("get_available_electives", { p_grade: 12 }),
		]);
		if (g11.error) logSupabaseError("StudentSignupPage.get_available_electives", g11.error, { grade: 11 });
		if (g12.error) logSupabaseError("StudentSignupPage.get_available_electives", g12.error, { grade: 12 });
		const rows = [...(g11.data ?? []), ...(g12.data ?? [])];
		const seen = new Set<string>();
		electives = rows.filter((r) => {
			if (seen.has(r.id)) return false;
			seen.add(r.id);
			return true;
		});
	} else if (batch.error && !isTransientFetchError(batch.error)) {
		logSupabaseError("StudentSignupPage.get_electives_for_signup", batch.error, {});
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center md:text-left">
				<h1 className="text-2xl font-bold tracking-tight">Student sign up</h1>
				<p className="text-balance text-sm text-muted-foreground">
					Create your profile; a parent connects later with the link code shown on your Profile after you sign
					up.
				</p>
			</div>
			<StudentSignupForm electives={electives} />
		</div>
	);
}
