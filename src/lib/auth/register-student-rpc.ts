import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type RegisterStudentArgs = {
	fullName: string;
	grade: number;
	section: string;
	stream: string | null;
	electiveSubjectId: string | null;
	parentName: string | null;
	parentEmail: string | null;
};

function isRegisterStudentCacheMiss(error: PostgrestError | null): boolean {
	if (!error) return false;
	return error.code === "PGRST202" && /register_student/i.test(error.message ?? "");
}

/**
 * Supports multiple historical RPC signatures while databases are in migration drift.
 */
export async function registerStudentViaRpc(
	supabase: SupabaseClient,
	args: RegisterStudentArgs,
): Promise<{ error: PostgrestError | null }> {
	const basePayload = {
		p_full_name: args.fullName,
		p_grade: args.grade,
		p_section: args.section,
		p_stream: args.stream,
		p_elective_subject_id: args.electiveSubjectId,
	};

	const attempts: Array<Record<string, unknown>> = [
		{
			...basePayload,
			p_parent_name: args.parentName,
			p_parent_email: args.parentEmail,
		},
		basePayload,
		{
			p_full_name: args.fullName,
			p_grade: args.grade,
			p_section: args.section,
			p_stream: args.stream,
		},
	];

	let latestError: PostgrestError | null = null;
	for (const payload of attempts) {
		const { error } = await supabase.rpc("register_student", payload);
		if (!error) {
			return { error: null };
		}
		latestError = error;
		if (!isRegisterStudentCacheMiss(error)) {
			return { error };
		}
	}

	return { error: latestError };
}
