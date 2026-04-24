"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export type ForgotState = { error?: string; success?: boolean };

export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
	const parsed = forgotPasswordSchema.safeParse({
		email: formData.get("email"),
	});
	if (!parsed.success) {
		return { error: "Enter a valid email address." };
	}

	const supabase = await createClient();
	let redirectTo: string;
	try {
		redirectTo = `${getAppUrl()}/auth/update-password`;
	} catch {
		return { error: "Password reset is unavailable until the app URL is configured." };
	}
	const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
		redirectTo,
	});

	if (error) {
		logSupabaseError("forgotPasswordAction.resetPasswordForEmail", error);
		return { error: "Unable to send a reset link. Please try again later." };
	}

	return { success: true };
}
