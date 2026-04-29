import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumePendingRegistration } from "@/lib/auth/pending-registration";
import { resolveSafeNextPath } from "@/lib/auth/safe-redirect";
import { resolvePostAuthPath } from "@/lib/auth/routing";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
	"signup",
	"invite",
	"magiclink",
	"recovery",
	"email_change",
	"email",
]);

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	const token_hash = searchParams.get("token_hash");
	const otpTypeRaw = searchParams.get("type");
	const otpType =
		otpTypeRaw && EMAIL_OTP_TYPES.has(otpTypeRaw as EmailOtpType)
			? (otpTypeRaw as EmailOtpType)
			: null;
	const next = searchParams.get("next");
	const err = searchParams.get("error");
	const errDesc = searchParams.get("error_description");

	if (err) {
		const u = new URL("/login", origin);
		u.searchParams.set("error", errDesc ?? err);
		return NextResponse.redirect(u);
	}

	const cookieStore = await cookies();

	const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				for (const { name, value, options } of cookiesToSet) {
					cookieStore.set(name, value, options);
				}
			},
		},
	});

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) {
			const u = new URL("/login", origin);
			u.searchParams.set("error", error.message);
			return NextResponse.redirect(u);
		}
	} else if (token_hash && otpType) {
		const { error: otpError } = await supabase.auth.verifyOtp({
			type: otpType,
			token_hash,
		});
		if (otpError) {
			const u = new URL("/login", origin);
			u.searchParams.set("error", otpError.message);
			return NextResponse.redirect(u);
		}
	}

	const pending = await consumePendingRegistration(supabase);
	if (pending === "completed_profile") {
		const destination = await resolvePostAuthPath();
		return NextResponse.redirect(new URL(destination, origin));
	}

	if (pending === "failed_parent_email_mismatch") {
		await supabase.auth.signOut();
		const u = new URL("/login", origin);
		u.searchParams.set(
			"error",
			"Guardian email mismatch: your parent login email must match the guardian email on your student's profile. Ask your student to open Profile and set guardian email to match, then try again or link from the parent portal after you log in.",
		);
		return NextResponse.redirect(u);
	}

	if (pending === "failed_student_not_found") {
		await supabase.auth.signOut();
		const u = new URL("/login", origin);
		u.searchParams.set(
			"error",
			"No student matched that link code. Ask your student for the six-character code from Profile (two letters + four numbers), then sign up again.",
		);
		return NextResponse.redirect(u);
	}

	if (pending === "failed_unsupported_teacher_signup") {
		await supabase.auth.signOut();
		const u = new URL("/login", origin);
		u.searchParams.set(
			"error",
			"Teacher signup is no longer available. Please sign up as a student or parent.",
		);
		return NextResponse.redirect(u);
	}

	if (pending === "failed") {
		await supabase.auth.signOut();
		const u = new URL("/login", origin);
		u.searchParams.set(
			"error",
			"Could not finish registration after email verification. Try signing up again or log in if you already have an account. Contact support if this continues.",
		);
		return NextResponse.redirect(u);
	}

	const fallback = await resolvePostAuthPath();
	const destination = resolveSafeNextPath(next, origin, fallback);
	return NextResponse.redirect(new URL(destination, origin));
}
