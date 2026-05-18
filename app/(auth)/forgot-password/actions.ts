"use server";

import * as Sentry from "@sentry/nextjs";

import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { logServerError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export type ForgotState = { error?: string; success?: boolean };

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
	const parsed = forgotPasswordSchema.safeParse({
		email: formData.get("email"),
	});
	if (!parsed.success) {
		return { error: "Enter a valid email address." };
	}

	// Sentry breadcrumb only — writing an `audit_logs` row here would have to
	// either store the email (regresses enumeration safety) or guess the
	// userId (forces a profile lookup which leaks existence by timing). The
	// recovery-completed path in updatePasswordAction is where we record the
	// authoritative audit row tied to a real user id.
	Sentry.addBreadcrumb({
		category: "auth.password.recovery",
		message: "reset link requested",
		level: "info",
	});

	// Operational failures (config, Supabase, network) are logged but never surfaced
	// to the wire. Returning success regardless of whether the email exists or the
	// backend errored prevents account enumeration via response-shape differences.
	try {
		const supabase = await createClient();
		// Route the email link through the auth callback so the recovery cookie can
		// be set server-side before the user reaches the password form. The callback
		// will redirect to `/auth/update-password` after exchanging the code.
		const redirectTo = `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
		const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
			redirectTo,
		});
		if (error) {
			logSupabaseError("forgotPasswordAction.resetPasswordForEmail", error);
		}
	} catch (error) {
		logServerError("forgotPasswordAction.unexpected", error);
	}

	return { success: true };
}
