import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";
import { insertInAppNotification } from "@/lib/notifications/insert";

export async function setTeacherVerified(teacherId: string, verified: boolean): Promise<boolean> {
	const rows = await db
		.update(profiles)
		.set({ isVerified: verified, updatedAt: new Date() })
		.where(eq(profiles.id, teacherId))
		.returning({ id: profiles.id, role: profiles.role });
	const r = rows[0];
	return Boolean(r && r.role === "teacher");
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
