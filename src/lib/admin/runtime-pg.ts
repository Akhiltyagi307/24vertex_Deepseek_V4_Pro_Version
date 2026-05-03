import "server-only";

import { eq, sql } from "drizzle-orm";

import { ADMIN_RUNTIME_KV_JWT_VERSION } from "@/lib/admin/constants";
import { db } from "@/db";
import { adminRuntimeKv } from "@/db/schema/admin-runtime-kv";

export async function getAdminJwtVersion(): Promise<number> {
	try {
		const rows = await db
			.select({ v: adminRuntimeKv.valueInt })
			.from(adminRuntimeKv)
			.where(eq(adminRuntimeKv.key, ADMIN_RUNTIME_KV_JWT_VERSION))
			.limit(1);
		return rows[0]?.v ?? 0;
	} catch {
		return 0;
	}
}

/** Bump stored JWT version (panic); returns new version. */
export async function bumpAdminJwtVersion(): Promise<number> {
	const [row] = await db
		.insert(adminRuntimeKv)
		.values({
			key: ADMIN_RUNTIME_KV_JWT_VERSION,
			valueInt: 1,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: adminRuntimeKv.key,
			set: {
				valueInt: sql`${adminRuntimeKv.valueInt} + 1`,
				updatedAt: sql`now()`,
			},
		})
		.returning({ valueInt: adminRuntimeKv.valueInt });
	return row?.valueInt ?? 1;
}
