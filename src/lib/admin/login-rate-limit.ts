import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { adminLoginRate } from "@/db/schema/admin-login-rate";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function isAdminLoginBlocked(ip: string): Promise<boolean> {
	if (ip === "0.0.0.0") return false;
	try {
		const rows = await db.select().from(adminLoginRate).where(eq(adminLoginRate.ip, ip)).limit(1);
		const row = rows[0];
		if (!row) return false;
		const deadline = row.windowStartedAt.getTime() + WINDOW_MS;
		if (Date.now() > deadline) return false;
		return row.failCount >= MAX_ATTEMPTS;
	} catch {
		return false;
	}
}

export async function recordAdminLoginFailure(ip: string): Promise<void> {
	if (ip === "0.0.0.0") return;
	const now = new Date();
	try {
		await db.transaction(async (tx) => {
			const rows = await tx.select().from(adminLoginRate).where(eq(adminLoginRate.ip, ip)).limit(1);
			const row = rows[0];
			if (!row) {
				await tx.insert(adminLoginRate).values({ ip, failCount: 1, windowStartedAt: now });
				return;
			}
			const expired = now.getTime() - row.windowStartedAt.getTime() > WINDOW_MS;
			if (expired) {
				await tx.update(adminLoginRate).set({ failCount: 1, windowStartedAt: now }).where(eq(adminLoginRate.ip, ip));
			} else {
				await tx
					.update(adminLoginRate)
					.set({ failCount: row.failCount + 1 })
					.where(eq(adminLoginRate.ip, ip));
			}
		});
	} catch {
		/* ignore: rate limit is best-effort */
	}
}

export async function clearAdminLoginFailures(ip: string): Promise<void> {
	if (ip === "0.0.0.0") return;
	try {
		await db.delete(adminLoginRate).where(eq(adminLoginRate.ip, ip));
	} catch {
		/* ignore */
	}
}
