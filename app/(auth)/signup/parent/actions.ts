"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { parentSignupSchema } from "@/lib/validations/auth";

export type ParentSignupState = { error?: string; needsVerification?: boolean };

/** Profile step after browser `signUp` (session cookies required). */
export async function completeParentRegistration(
	_prev: ParentSignupState | undefined,
	formData: FormData,
): Promise<ParentSignupState> {
	const raw = Object.fromEntries(formData.entries());
	const parsed = parentSignupSchema.safeParse({
		email: raw.email,
		password: raw.password,
		fullName: raw.fullName,
	});

	if (!parsed.success) {
		return { error: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid form" };
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

	const { error: rpcError } = await supabase.rpc("register_parent", {
		p_full_name: v.fullName,
	});

	if (rpcError) {
		logSupabaseError("completeParentRegistration.register_parent", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	redirect("/parent/dashboard");
}
