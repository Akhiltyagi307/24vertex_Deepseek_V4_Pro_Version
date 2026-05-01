"use server";

import { redirect } from "next/navigation";
import {
	classifyLinkParentRpc,
	formatLinkParentRpcDevDetails,
	userMessageForLinkParentRpcFailure,
} from "@/lib/auth/link-parent-rpc-errors";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
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
		const kind = classifyLinkParentRpc(error);
		let message = userMessageForLinkParentRpcFailure(kind);
		if (kind === "generic" && process.env.NODE_ENV === "development") {
			const detail = formatLinkParentRpcDevDetails(error);
			if (detail) {
				message = `${message} [dev: ${detail}]`;
			}
		}
		return { error: message };
	}

	redirect("/parent/dashboard");
}
