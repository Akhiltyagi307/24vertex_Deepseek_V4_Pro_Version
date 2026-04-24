import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { StudentSignupForm } from "./student-form";

export const dynamic = "force-dynamic";

export default async function StudentSignupPage() {
	const supabase = await createClient();
	/** Public signup: single RPC (replaces two `get_available_electives` calls). */
	const { data, error } = await supabase.rpc("get_electives_for_signup");
	if (error) logSupabaseError("StudentSignupPage.get_electives_for_signup", error, {});

	const electives = data ?? [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Student sign up</h1>
				<p className="mt-1 text-sm text-muted-foreground">Create your student profile for EduAI.</p>
			</div>
			<StudentSignupForm electives={electives} />
		</div>
	);
}
