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
import { processParentLinkNotifications } from "@/lib/parent/process-parent-link-notifications";
import { writeParentAudit } from "@/lib/parent/audit";
import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import {
	consumeParentLinkPerParent,
	consumeParentLinkPerStudent,
} from "@/lib/parent/rate-limit";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";
import { linkParentSchema } from "@/lib/validations/auth";

export type LinkChildState = { error?: string; success?: boolean };

const THROTTLED_USER_MESSAGE =
	"Too many link attempts. Wait a few minutes and try again.";

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

	// Per-parent cap (10/hour). The defining brake against brute-forcing
	// the link code: even an attacker with infinite codes can only try 10
	// per hour from one compromised parent account.
	if (parentUser?.id) {
		const perParent = await consumeParentLinkPerParent(parentUser.id);
		if (!perParent.ok) {
			await writeParentAudit({
				action: PARENT_ACTIONS.LINK_CHILD_THROTTLED,
				parentId: parentUser.id,
				payload: { scope: "per_parent", student_ref: parsed.data.studentId },
				ipAddress: ip,
				userAgent: ua,
			});
			return { error: THROTTLED_USER_MESSAGE };
		}
	}

	// Per-student-reference cap (5/15min). Cheap protection against
	// repeated hits on the same input — also catches a single compromised
	// parent who tries the same wrong code in a loop.
	const perStudent = await consumeParentLinkPerStudent(parsed.data.studentId);
	if (!perStudent.ok) {
		if (parentUser?.id) {
			await writeParentAudit({
				action: PARENT_ACTIONS.LINK_CHILD_THROTTLED,
				parentId: parentUser.id,
				payload: { scope: "per_student_ref", student_ref: parsed.data.studentId },
				ipAddress: ip,
				userAgent: ua,
			});
		}
		return { error: THROTTLED_USER_MESSAGE };
	}

	const { data: linkStatusRaw, error } = await supabase.rpc("link_parent_to_student", {
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
			Sentry.metrics.count("parent.link.failure", 1, {
				attributes: { reason: kind },
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
		Sentry.metrics.count("parent.link.success", 1);
		const linkStatus = linkStatusRaw === "pending" ? "pending" : "active";
		await processParentLinkNotifications({
			supabase,
			parentId: parentUser.id,
			studentRef: parsed.data.studentId,
			linkStatus,
		});
	}

	if (linkStatusRaw === "pending") {
		redirect("/parent/link-child?status=pending");
	}

	redirect("/parent/dashboard");
}
