import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";

/** Soft-delete PII on `profiles` (reversible window is a product policy; DB stores deleted_at). */
export async function anonymizeProfile(userId: string): Promise<void> {
	const now = new Date();
	await db
		.update(profiles)
		.set({
			fullName: "Deleted User",
			parentName: null,
			parentEmail: null,
			avatarUrl: null,
			bio: null,
			phone: null,
			website: null,
			schoolName: null,
			deletedAt: now,
			updatedAt: now,
		})
		.where(eq(profiles.id, userId));
}
