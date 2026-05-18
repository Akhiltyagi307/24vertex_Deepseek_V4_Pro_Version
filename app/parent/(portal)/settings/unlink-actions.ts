"use server";

import * as Sentry from "@sentry/nextjs";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clientIpFromHeaders } from "@/lib/admin/api-request-meta";
import { getServerUser } from "@/lib/auth/get-server-user";
import { PARENT_ACTIVE_STUDENT_COOKIE } from "@/lib/parent/active-student-cookie";
import { writeParentAudit } from "@/lib/parent/audit";
import { PARENT_ACTIONS } from "@/lib/parent/audit-actions";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

const unlinkSchema = z
	.object({
		studentId: z.string().uuid(),
	})
	.strict();

export type UnlinkChildState = { error?: string; success?: boolean };

/**
 * Server action: revoke an active parent ↔ student link.
 *
 * Calls the SECURITY DEFINER RPC `unlink_parent_from_student`, which revokes
 * the parent_student_links row and writes a forensic event to
 * `parent_session_invalidations` (operator-readable, not consumed by
 * requireParent). Clears the active-student cookie locally if it pointed at
 * the just-unlinked child. Other open tabs are bounced to
 * /parent/select-student on their next page load via assertParentActiveLink.
 */
export async function unlinkParentFromStudent(
	_prev: UnlinkChildState,
	formData: FormData,
): Promise<UnlinkChildState> {
	const parsed = unlinkSchema.safeParse({
		studentId: formData.get("studentId"),
	});
	if (!parsed.success) {
		return { error: "Invalid student id." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Sign in to continue." };
	}

	const reqHeaders = await headers();
	const ip = clientIpFromHeaders(reqHeaders);
	const ua = reqHeaders.get("user-agent") ?? null;

	const supabase = await createClient();
	return Sentry.startSpan(
		{ name: "parent.unlink_child", op: "function" },
		async () => {
			const { error } = await supabase.rpc("unlink_parent_from_student", {
				p_student_id: parsed.data.studentId,
			});
			if (error) {
				logSupabaseError("unlinkParentFromStudent.rpc", error, {
					parentId: user.id,
					studentId: parsed.data.studentId,
				});
				await writeParentAudit({
					action: PARENT_ACTIONS.UNLINK_CHILD,
					parentId: user.id,
					targetType: "student",
					targetId: parsed.data.studentId,
					payload: { outcome: "failed", raw_message: error.message },
					ipAddress: ip,
					userAgent: ua,
				});
				return { error: "Could not unlink student. Please try again." };
			}

			await writeParentAudit({
				action: PARENT_ACTIONS.UNLINK_CHILD,
				parentId: user.id,
				targetType: "student",
				targetId: parsed.data.studentId,
				payload: { outcome: "ok" },
				ipAddress: ip,
				userAgent: ua,
			});

			// Clear the active-student cookie for this tab if it was pointing
			// at the just-unlinked child. Other tabs land on
			// /parent/select-student on next navigation because
			// assertParentActiveLink() returns false for the revoked link.
			const jar = await cookies();
			if (jar.get(PARENT_ACTIVE_STUDENT_COOKIE)?.value === parsed.data.studentId) {
				jar.delete(PARENT_ACTIVE_STUDENT_COOKIE);
			}

			revalidatePath("/parent", "layout");
			return { success: true };
		},
	);
}
