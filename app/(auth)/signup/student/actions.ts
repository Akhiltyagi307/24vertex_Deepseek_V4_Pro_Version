"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { studentSignupSchema } from "@/lib/validations/auth";

export type StudentSignupState = { error?: string; needsVerification?: boolean };

/** Creates the student profile after browser `signUp` (session cookies must be present). */
export async function completeStudentRegistration(
	_prev: StudentSignupState | undefined,
	formData: FormData,
): Promise<StudentSignupState> {
	const raw = Object.fromEntries(formData.entries());
	const parsed = studentSignupSchema.safeParse({
		email: raw.email,
		password: raw.password,
		fullName: raw.fullName,
		grade: raw.grade,
		section: raw.section,
		stream: raw.stream === "" || raw.stream == null ? null : raw.stream,
		electiveSubjectId:
			typeof raw.electiveSubjectId === "string" && raw.electiveSubjectId.length > 0
				? raw.electiveSubjectId
				: null,
		parentName: raw.parentName,
		parentEmail: raw.parentEmail,
	});

	if (!parsed.success) {
		const msg = parsed.error.flatten().fieldErrors
			? Object.values(parsed.error.flatten().fieldErrors).flat().join(" ")
			: parsed.error.message;
		return { error: msg || "Invalid form" };
	}

	const v = parsed.data;
	const supabase = await createClient();
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return { error: "Session missing. Try again or log in." };
	}

	if (user.email?.toLowerCase() !== v.email.toLowerCase()) {
		return { error: "Email does not match the signed-in account." };
	}

	const streamVal = v.grade >= 11 && v.grade <= 12 ? v.stream : null;
	const electiveVal = v.grade >= 11 && v.grade <= 12 ? v.electiveSubjectId : null;

	const { error: rpcError } = await supabase.rpc("register_student", {
		p_full_name: v.fullName,
		p_grade: v.grade,
		p_section: v.section.trim(),
		p_stream: streamVal,
		p_elective_subject_id: electiveVal,
		p_parent_name: v.parentName ?? null,
		p_parent_email: v.parentEmail ?? null,
	});

	if (rpcError) {
		logSupabaseError("completeStudentRegistration.register_student", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	redirect("/student/dashboard");
}
