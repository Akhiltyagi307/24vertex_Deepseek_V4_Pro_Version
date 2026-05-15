"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { sendTeacherPendingApprovalEmail } from "@/lib/email/teacher-pending-approval-email";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { teacherSignupSchema } from "@/lib/validations/auth";

export type TeacherSignupState = { error?: string; needsVerification?: boolean };

/** Profile step after browser `signUp` (session cookies required). */
export async function completeTeacherRegistration(
	_prev: TeacherSignupState | undefined,
	formData: FormData,
): Promise<TeacherSignupState> {
	const raw = Object.fromEntries(formData.entries());
	const parsed = teacherSignupSchema.safeParse({
		email: raw.email,
		password: raw.password,
		fullName: raw.fullName,
		phone: raw.phone,
		schoolName: raw.schoolName === "" || raw.schoolName == null ? undefined : raw.schoolName,
	});

	if (!parsed.success) {
		const flat = parsed.error.flatten().fieldErrors;
		const msg =
			Object.values(flat).flat()[0] ??
			parsed.error.flatten().formErrors[0] ??
			"Check your details.";
		return { error: msg };
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

	const { error: rpcError } = await supabase.rpc("register_teacher", {
		p_full_name: v.fullName,
		p_school_name: v.schoolName ?? null,
		p_phone: v.phone,
	});

	if (rpcError) {
		logSupabaseError("completeTeacherRegistration.register_teacher", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	const sent = await sendTeacherPendingApprovalEmail(v.email, v.fullName, {
		dedupKey: `teacher-pending-approval:${user.id}`,
	});
	if (!sent.ok) {
		Sentry.captureMessage("teacher_pending_approval_email_failed", {
			level: "warning",
			extra: { error: sent.error },
		});
	}

	redirect("/teacher/pending");
}
