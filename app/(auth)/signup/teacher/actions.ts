"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuthAudit } from "@/lib/auth/audit";
import { AUTH_ACTIONS } from "@/lib/auth/audit-actions";
import { getServerUser } from "@/lib/auth/get-server-user";
import { consumeAuthSignup } from "@/lib/auth/rate-limit";
import { hasRecentTeacherRejection } from "@/lib/auth/teacher-recent-rejection-check";
import { createClient } from "@/lib/supabase/server";
import { sendTeacherPendingApprovalEmail } from "@/lib/email/teacher-pending-approval-email";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
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

	const ip = clientIpFromHeaders(await headers());
	const rl = await consumeAuthSignup(ip);
	if (!rl.ok) {
		return { error: "Too many sign-up attempts. Please wait a few minutes and try again." };
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

	// 24h cooldown after an admin rejection — pulls from `teacher_approval_history`,
	// which is empty until an admin reject route is built. Forward-compat guard so the
	// signup flow is wired up the day a reject UI lands.
	const cooldown = await hasRecentTeacherRejection(v.email);
	if (cooldown.cooldownActive) {
		const retryAt = cooldown.retryAfter?.toUTCString() ?? "in a few hours";
		return {
			error: `This email was recently rejected for a teacher account. Try again after ${retryAt}, or contact support.`,
		};
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

	const reqHeaders = await headers();
	await writeAuthAudit({
		action: AUTH_ACTIONS.SIGNUP_COMPLETED,
		userId: user.id,
		entityType: "profile",
		entityId: user.id,
		changes: { role: "teacher", source: "email", awaiting_approval: true },
		ipAddress: clientIpFromHeaders(reqHeaders),
	});
	Sentry.addBreadcrumb({
		category: "auth.signup",
		message: "teacher profile created — pending approval",
		level: "info",
	});

	redirect("/teacher/pending");
}
