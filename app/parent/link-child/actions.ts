"use server";

import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import {
	classifyLinkParentRpc,
	formatLinkParentRpcDevDetails,
	userMessageForLinkParentRpcFailure,
} from "@/lib/auth/link-parent-rpc-errors";
import { resolveStudentProfileIdForLinkRef } from "@/lib/auth/resolve-student-link-ref";
import { logSupabaseError, logServerError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { linkParentSchema } from "@/lib/validations/auth";
import {
	notifyParentChildLinkConfirmed,
	notifyParentLinkedToStudent,
} from "@/lib/notifications/account-security";

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

	// Notifications are a side-effect after the link RPC has already
	// committed — if Resend or the in-app notify fails, the parent IS
	// linked and we MUST still redirect them. Previously these awaits
	// could throw synchronously and bubble up, leaving the parent on a
	// broken form even though the link succeeded. Wrap each call so
	// notification failures land in Sentry as warnings (not errors —
	// the user-visible operation succeeded) and the redirect proceeds.
	const {
		data: { user: parentUser },
	} = await supabase.auth.getUser();
	if (parentUser?.id) {
		const studentId = await resolveStudentProfileIdForLinkRef(supabase, parsed.data.studentId);
		if (studentId) {
			try {
				await notifyParentLinkedToStudent({ studentId, parentId: parentUser.id });
			} catch (e) {
				logServerError("linkParentToStudent.notifyParentLinkedToStudent", e, {
					studentId,
					parentId: parentUser.id,
				});
				Sentry.captureException(e, {
					level: "warning",
					tags: { feature: "parent.link", phase: "notify_linked" },
				});
			}
			try {
				await notifyParentChildLinkConfirmed({ studentId, parentId: parentUser.id });
			} catch (e) {
				logServerError("linkParentToStudent.notifyParentChildLinkConfirmed", e, {
					studentId,
					parentId: parentUser.id,
				});
				Sentry.captureException(e, {
					level: "warning",
					tags: { feature: "parent.link", phase: "notify_confirmed" },
				});
			}
		}
	}

	redirect("/parent/dashboard");
}
