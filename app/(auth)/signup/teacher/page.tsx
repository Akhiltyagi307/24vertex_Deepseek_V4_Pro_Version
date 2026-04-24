import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { TeacherSignupForm } from "./teacher-form";

export const dynamic = "force-dynamic";

export default async function TeacherSignupPage() {
	const supabase = await createClient();
	/** Public signup: one RPC (replaces seven `get_all_subjects_for_grade` calls). */
	const { data, error } = await supabase.rpc("get_subjects_for_teacher_signup");
	if (error) {
		logSupabaseError("TeacherSignupPage.get_subjects_for_teacher_signup", error, {});
	}
	const subjects = [...(data ?? [])];
	subjects.sort((a, b) => a.grade - b.grade || String(a.name).localeCompare(String(b.name)));

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Teacher sign up</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Your account will be reviewed by an administrator before you can create assignments or send notifications.
				</p>
			</div>
			<TeacherSignupForm subjects={subjects} />
		</div>
	);
}
