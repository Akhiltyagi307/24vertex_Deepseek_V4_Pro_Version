import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema/comms-audit";
import { profiles } from "@/db/schema/profiles";

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
	await db.insert(notifications).values({
		recipientId: teacherId,
		senderId: null,
		title,
		body,
		type: "system",
		priority: "normal",
		category: "onboarding",
	});
}
