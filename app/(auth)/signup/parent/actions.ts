"use server";

import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth/get-server-user";
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
		studentLinkCode: raw.studentLinkCode,
	});

	if (!parsed.success) {
		return { error: parsed.error.flatten().fieldErrors.studentLinkCode?.[0] ?? "Check your details." };
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

	const { error: rpcError } = await supabase.rpc("register_parent", {
		p_full_name: v.fullName,
	});

	if (rpcError) {
		logSupabaseError("completeParentRegistration.register_parent", rpcError);
		return { error: "We couldn't complete registration. Try again or contact support." };
	}

	const { error: linkErr } = await supabase.rpc("link_parent_to_student", {
		p_student_ref: v.studentLinkCode,
	});

	if (linkErr) {
		logSupabaseError("completeParentRegistration.link_parent_to_student", linkErr);
		return {
			error:
				"We created your account but couldn't link that student. Check their six-character link code from Profile. If their profile already has a guardian email on file, your parent login email must match it. You can link again from the parent portal.",
		};
	}

	redirect("/parent/select-student");
}
