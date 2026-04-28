"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { linkParentSchema } from "@/lib/validations/auth";

export type LinkChildState = { error?: string; success?: boolean };

export async function linkParentToStudent(
	_prev: LinkChildState,
	formData: FormData,
): Promise<LinkChildState> {
	const parsed = linkParentSchema.safeParse({
		studentId: formData.get("studentId"),
	});
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid link code or ID." };
	}

	const supabase = await createClient();
	const { error } = await supabase.rpc("link_parent_to_student", {
		p_student_ref: parsed.data.studentId,
	});

	if (error) {
		logSupabaseError("linkParentToStudent.link_parent_to_student", error);
		return {
			error:
				"We couldn't link that account. Check the link code or student ID. If their profile lists a guardian email, your parent login email must match it.",
		};
	}

	redirect("/parent/dashboard");
}
