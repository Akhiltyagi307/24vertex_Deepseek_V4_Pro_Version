import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { StudentSignupForm } from "./student-form";

export const dynamic = "force-dynamic";

export default async function StudentSignupPage() {
	const supabase = await createClient();
	/** Prefer batch RPC from `20260424150000_signup_batch_rpcs.sql`; fall back if migration not applied. */
	const batch = await supabase.rpc("get_electives_for_signup");
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
	} else if (batch.error) {
		logSupabaseError("StudentSignupPage.get_electives_for_signup", batch.error, {});
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Student sign up</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Create your profile; a parent connects later with the link code shown on your Profile after you sign
					up.
				</p>
			</div>
			<StudentSignupForm electives={electives} />
		</div>
	);
}
