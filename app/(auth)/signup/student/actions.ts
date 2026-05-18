"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuthAudit } from "@/lib/auth/audit";
import { AUTH_ACTIONS } from "@/lib/auth/audit-actions";
import { getServerUser } from "@/lib/auth/get-server-user";
import { createClient } from "@/lib/supabase/server";
import { registerStudentViaRpc } from "@/lib/auth/register-student-rpc";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
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
	const user = await getServerUser();

	if (!user) {
		return { error: "Session missing. Try again or log in." };
	}

	const supabase = await createClient();

	if (user.email?.toLowerCase() !== v.email.toLowerCase()) {
		return { error: "Email does not match the signed-in account." };
	}

	const streamVal = v.grade >= 11 && v.grade <= 12 ? (v.stream ?? null) : null;
	const electiveVal = v.grade >= 11 && v.grade <= 12 ? (v.electiveSubjectId ?? null) : null;

	const { error: rpcError } = await registerStudentViaRpc(supabase, {
		fullName: v.fullName,
		grade: v.grade,
		section: v.section.trim(),
		stream: streamVal,
		electiveSubjectId: electiveVal,
		parentName: v.parentName ?? null,
		parentEmail: v.parentEmail ?? null,
	});

	if (rpcError) {
		logSupabaseError("completeStudentRegistration.register_student", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	const reqHeaders = await headers();
	await writeAuthAudit({
		action: AUTH_ACTIONS.SIGNUP_COMPLETED,
		userId: user.id,
		entityType: "profile",
		entityId: user.id,
		changes: { role: "student", source: "email" },
		ipAddress: clientIpFromHeaders(reqHeaders),
	});
	Sentry.addBreadcrumb({
		category: "auth.signup",
		message: "student profile created",
		level: "info",
	});

	redirect("/student/dashboard");
}
