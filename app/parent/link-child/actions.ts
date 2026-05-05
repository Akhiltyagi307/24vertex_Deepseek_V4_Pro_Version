"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import {
	classifyLinkParentRpc,
	formatLinkParentRpcDevDetails,
	userMessageForLinkParentRpcFailure,
} from "@/lib/auth/link-parent-rpc-errors";
import { resolveStudentProfileIdForLinkRef } from "@/lib/auth/resolve-student-link-ref";
import {
	notifyParentChildLinkConfirmed,
	notifyParentLinkedToStudent,
} from "@/lib/notifications/account-security";
import { writeParentAudit } from "@/lib/parent/audit";
import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import { logSupabaseError, logServerError } from "@/lib/server/log-supabase-error";
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

	// Fetch the parent user up-front so the audit row has a parent_id on
	// both the success and the failure path. Previously the user lookup
	// happened only after the RPC succeeded, which left link-failure
	// attempts without a durable record.
	const {
		data: { user: parentUser },
	} = await supabase.auth.getUser();

	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);
	const ua = reqHeaders.get("user-agent") ?? null;

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
		if (parentUser?.id) {
			await writeParentAudit({
				action: PARENT_ACTIONS.LINK_CHILD_FAILED,
				parentId: parentUser.id,
				payload: { kind, raw_message: error.message },
				ipAddress: ip,
				userAgent: ua,
			});
		}
		return { error: message };
	}

	// Notifications are a side-effect after the link RPC has already
	// committed — if Resend or the in-app notify fails, the parent IS
	// linked and we MUST still redirect them. Wrap each call so
	// notification failures land in Sentry as warnings (not errors —
	// the user-visible operation succeeded) and the redirect proceeds.
	if (parentUser?.id) {
		const studentId = await resolveStudentProfileIdForLinkRef(supabase, parsed.data.studentId);
		await writeParentAudit({
			action: PARENT_ACTIONS.LINK_CHILD_SUCCESS,
			parentId: parentUser.id,
			targetType: "student",
			targetId: studentId ?? parsed.data.studentId,
			payload: { link_ref: parsed.data.studentId },
			ipAddress: ip,
			userAgent: ua,
		});
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
