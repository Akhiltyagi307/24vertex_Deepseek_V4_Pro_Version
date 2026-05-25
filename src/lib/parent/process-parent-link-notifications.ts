import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveStudentProfileIdForLinkRef } from "@/lib/auth/resolve-student-link-ref";
import {
	notifyParentChildLinkConfirmed,
	notifyParentLinkPendingApproval,
	notifyParentLinkedToStudent,
	notifyStudentParentLinkApprovalRequest,
} from "@/lib/notifications/account-security";
import { logServerError } from "@/lib/server/log-supabase-error";

export type ParentLinkOutcomeStatus = "active" | "pending";

/**
 * Side effects after `link_parent_to_student` succeeds. Never throws; logs to Sentry on failure.
 */
export async function processParentLinkNotifications(input: {
	supabase: SupabaseClient;
	parentId: string;
	studentRef: string;
	linkStatus: ParentLinkOutcomeStatus;
}): Promise<void> {
	const studentId = await resolveStudentProfileIdForLinkRef(input.supabase, input.studentRef);
	if (!studentId) return;

	if (input.linkStatus === "pending") {
		try {
			await notifyStudentParentLinkApprovalRequest({
				studentId,
				parentId: input.parentId,
			});
		} catch (e) {
			logServerError("processParentLinkNotifications.notifyStudentParentLinkApprovalRequest", e, {
				studentId,
				parentId: input.parentId,
			});
			Sentry.captureException(e, {
				level: "warning",
				tags: { feature: "parent.link", phase: "notify_pending_student" },
			});
		}
		try {
			await notifyParentLinkPendingApproval({ studentId, parentId: input.parentId });
		} catch (e) {
			logServerError("processParentLinkNotifications.notifyParentLinkPendingApproval", e, {
				studentId,
				parentId: input.parentId,
			});
			Sentry.captureException(e, {
				level: "warning",
				tags: { feature: "parent.link", phase: "notify_pending_parent" },
			});
		}
		return;
	}

	try {
		await notifyParentLinkedToStudent({ studentId, parentId: input.parentId });
	} catch (e) {
		logServerError("processParentLinkNotifications.notifyParentLinkedToStudent", e, {
			studentId,
			parentId: input.parentId,
		});
		Sentry.captureException(e, {
			level: "warning",
			tags: { feature: "parent.link", phase: "notify_linked" },
		});
	}
	try {
		await notifyParentChildLinkConfirmed({ studentId, parentId: input.parentId });
	} catch (e) {
		logServerError("processParentLinkNotifications.notifyParentChildLinkConfirmed", e, {
			studentId,
			parentId: input.parentId,
		});
		Sentry.captureException(e, {
			level: "warning",
			tags: { feature: "parent.link", phase: "notify_confirmed" },
		});
	}
}
