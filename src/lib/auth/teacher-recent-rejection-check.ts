import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { teacherApprovalHistory } from "@/db/schema/teacher-approval-history";

const COOLDOWN_HOURS = 24;

export type TeacherRecentRejectionCheck = {
	cooldownActive: boolean;
	retryAfter?: Date;
};

/**
 * Reject teacher re-signups within 24h of a 'rejected' history row for the
 * same email. Email match is case-insensitive (the table has a functional
 * index on `lower(email)`).
 *
 * Today there's no admin reject UI in the repo, so this helper will return
 * `cooldownActive: false` for every call until a reject route inserts rows.
 * The check is forward-compat scaffolding sitting on the same source of
 * truth as the approval audit.
 */
export async function hasRecentTeacherRejection(email: string): Promise<TeacherRecentRejectionCheck> {
	const normalized = email.trim();
	if (!normalized) return { cooldownActive: false };

	const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

	const rows = await db
		.select({ createdAt: teacherApprovalHistory.createdAt })
		.from(teacherApprovalHistory)
		.where(
			and(
				eq(teacherApprovalHistory.action, "rejected"),
				sql`lower(${teacherApprovalHistory.email}) = lower(${normalized})`,
				gt(teacherApprovalHistory.createdAt, cutoff),
			),
		)
		.orderBy(desc(teacherApprovalHistory.createdAt))
		.limit(1);

	const latest = rows[0]?.createdAt;
	if (!latest) return { cooldownActive: false };

	const retryAfter = new Date(latest.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
	return { cooldownActive: true, retryAfter };
}
