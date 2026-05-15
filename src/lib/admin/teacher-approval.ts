import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { insertInAppNotification } from "@/lib/notifications/insert";

/**
 * Flip `profiles.is_verified` for a teacher via `admin_set_teacher_verified`,
 * which sets `eduai.bypass_profile_update_guard` and updates in one server-side
 * call so transaction poolers cannot lose the session flag between statements.
 */
export async function setTeacherVerified(teacherId: string, verified: boolean): Promise<boolean> {
	const rows = await db.execute(
		sql`select public.admin_set_teacher_verified(${teacherId}::uuid, ${verified}) as ok`,
	);
	const row = rows[0] as { ok: boolean } | undefined;
	return Boolean(row?.ok);
}

export async function insertTeacherWelcomeNotification(teacherId: string, title: string, body: string): Promise<void> {
	// Welcome card is a one-time trust signal, similar to parent-link
	// confirmations. Force the in-app row even when prefs say "off" so a
	// brand-new teacher sees onboarding content. If teachers ever get a
	// notifications UI, the row written here is still subject to bell-side
	// filtering by category ("onboarding") rather than being suppressed at
	// write time.
	await insertInAppNotification({
		recipientId: teacherId,
		title,
		body,
		type: "system",
		category: "onboarding",
		forceInApp: true,
	});
}
