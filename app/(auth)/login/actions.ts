"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuthAudit } from "@/lib/auth/audit";
import { AUTH_ACTIONS, classifyLoginFailure } from "@/lib/auth/audit-actions";
import { postAuthPathFromProfile } from "@/lib/auth/post-auth-path";
import { consumeAuthLogin } from "@/lib/auth/rate-limit";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = { error?: string };

export async function loginAction(
	_prev: LoginState,
	formData: FormData,
): Promise<LoginState> {
	const parsed = loginSchema.safeParse({
		email: formData.get("email"),
		password: formData.get("password"),
	});
	if (!parsed.success) {
		return { error: "Enter a valid email and password (at least 8 characters)." };
	}

	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);

	const rl = await consumeAuthLogin(ip, parsed.data.email);
	if (!rl.ok) {
		await writeAuthAudit({
			action: AUTH_ACTIONS.LOGIN_FAILED,
			userId: null,
			changes: { reason: "rate_limited" },
			ipAddress: ip,
		});
		return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
	}

	const supabase = await createClient();
	const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
		email: parsed.data.email,
		password: parsed.data.password,
	});
	if (signInError) {
		const reason = classifyLoginFailure(signInError.message);
		Sentry.addBreadcrumb({
			category: "auth.login",
			message: "signInWithPassword rejected",
			level: "info",
			data: { reason },
		});
		await writeAuthAudit({
			action: AUTH_ACTIONS.LOGIN_FAILED,
			userId: null,
			changes: { reason },
			ipAddress: ip,
		});
		// Supabase emits enumeration-safe copy ("Invalid login credentials") that's
		// identical for unknown email and wrong password. Pass it through verbatim
		// so locked / unverified / rate-limited cases still surface to the user.
		return { error: signInError.message };
	}

	const userId = signInData.user?.id;
	if (!userId) {
		redirect("/");
	}

	const { error: profileError, data: profileRow } = await supabase
		.from("profiles")
		.select("role, is_verified")
		.eq("id", userId)
		.maybeSingle();
	if (profileError) {
		logSupabaseError("loginAction.profiles.select", profileError, { userId });
		redirect("/");
	}

	await writeAuthAudit({
		action: AUTH_ACTIONS.LOGIN_SUCCEEDED,
		userId,
		changes: { role: profileRow?.role ?? null },
		ipAddress: ip,
	});
	Sentry.addBreadcrumb({
		category: "auth.login",
		message: "signed in",
		level: "info",
		data: { role: profileRow?.role ?? null },
	});

	const destination = postAuthPathFromProfile(
		profileRow
			? { role: profileRow.role, is_verified: profileRow.is_verified }
			: null,
	);
	redirect(destination);
}
