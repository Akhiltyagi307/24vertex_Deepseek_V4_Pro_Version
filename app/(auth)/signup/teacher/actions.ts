"use server";

import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { teacherSignupSchema } from "@/lib/validations/auth";

export type TeacherSignupState = { error?: string; needsVerification?: boolean };

/** Profile step after browser `signUp` (session cookies required). */
export async function completeTeacherRegistration(
	_prev: TeacherSignupState | undefined,
	formData: FormData,
): Promise<TeacherSignupState> {
	const raw = Object.fromEntries(formData.entries());
	const grade = Number(raw.grade);
	const parsed = teacherSignupSchema.safeParse({
		email: raw.email,
		password: raw.password,
		fullName: raw.fullName,
		schoolName: raw.schoolName,
		assignments: [
			{
				grade,
				section: String(raw.section).trim(),
				subjectId: String(raw.subjectId),
			},
		],
	});

	if (!parsed.success) {
		return { error: parsed.error.flatten().fieldErrors.assignments?.[0] ?? "Invalid form" };
	}

	const v = parsed.data;
	const user = await getServerUser();

	if (!user) {
		return { error: "Session missing. Try again or log in." };
	}

	const supabase = await createClient();

	if (user.email?.toLowerCase() !== v.email.toLowerCase()) {
		return { error: "Email does not match the signed-in account." };
	}

	const subjectIds = [...new Set(v.assignments.map((a) => a.subjectId))];
	const pAssignments = v.assignments.map((a) => ({
		grade: a.grade,
		section: a.section,
		subject_id: a.subjectId,
	}));

	const { error: rpcError } = await supabase.rpc("register_teacher", {
		p_full_name: v.fullName,
		p_school_name: v.schoolName,
		p_subjects_taught: subjectIds,
		p_assignments: pAssignments,
	});

	if (rpcError) {
		logSupabaseError("completeTeacherRegistration.register_teacher", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	redirect("/teacher/pending");
}
