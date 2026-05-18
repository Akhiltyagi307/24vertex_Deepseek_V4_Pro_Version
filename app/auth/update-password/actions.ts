"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordPasswordChangedAction } from "@/lib/auth/account-security-actions";
import { writeAuthAudit } from "@/lib/auth/audit";
import { AUTH_ACTIONS } from "@/lib/auth/audit-actions";
import { closeRecoveryWindow, readRecoveryWindow } from "@/lib/auth/recovery-window";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { recoveryUpdatePasswordSchema } from "@/lib/validations/auth";

export type UpdatePasswordState = { error?: string };

const EXPIRED_MESSAGE =
	"Recovery link expired or invalid. Request a new reset email and try again.";

export async function updatePasswordAction(
	_prev: UpdatePasswordState,
	formData: FormData,
): Promise<UpdatePasswordState> {
	const parsed = recoveryUpdatePasswordSchema.safeParse({
		newPassword: formData.get("newPassword"),
		confirmPassword: formData.get("confirmPassword"),
	});
	if (!parsed.success) {
		const first =
			Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
			parsed.error.issues[0]?.message ??
			"Check your password fields.";
		return { error: first };
	}

	const recoveryWindow = await readRecoveryWindow();
	if (!recoveryWindow) {
		return { error: EXPIRED_MESSAGE };
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user?.id || user.id !== recoveryWindow.userId) {
		await closeRecoveryWindow();
		return { error: EXPIRED_MESSAGE };
	}

	const { error: updErr } = await supabase.auth.updateUser({
		password: parsed.data.newPassword,
	});
	if (updErr) {
		logSupabaseError("updatePasswordAction.updateUser", updErr);
		return { error: "Could not update password. Try again in a moment." };
	}

	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);
	await writeAuthAudit({
		action: AUTH_ACTIONS.PASSWORD_RECOVERY_COMPLETED,
		userId: user.id,
		ipAddress: ip,
	});
	Sentry.addBreadcrumb({
		category: "auth.password.recovery",
		message: "password updated",
		level: "info",
	});

	try {
		await recordPasswordChangedAction();
	} catch (err) {
		logServerError("updatePasswordAction.audit", err);
	}
	await closeRecoveryWindow();

	// Force a global revoke so the recovery-window session can't be reused
	// (and any stale tabs on the same account drop their session on next reload).
	try {
		await supabase.auth.signOut({ scope: "global" });
	} catch (err) {
		logServerError("updatePasswordAction.signOut", err);
	}

	redirect("/login?reset=success");
}
