import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { featureFlags } from "@/db/schema/feature-flags";

export async function isAdminTotpRequired(): Promise<boolean> {
	try {
		const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, "ADMIN_TOTP_REQUIRED")).limit(1);
		const v = rows[0]?.value;
		if (v === true || v === false) return v;
		if (typeof v === "string") return v === "true";
		if (v && typeof v === "object" && "enabled" in v) {
			return Boolean((v as { enabled?: boolean }).enabled);
		}
		return false;
	} catch {
		return false;
	}
}

export async function isModerationPreCheckEnabled(): Promise<boolean> {
	try {
		const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, "MODERATION_PRE_CHECK")).limit(1);
		const v = rows[0]?.value;
		if (v === false) return false;
		if (v === true) return true;
		if (typeof v === "string") return v !== "false";
		if (v && typeof v === "object" && "enabled" in v) {
			return Boolean((v as { enabled?: boolean }).enabled);
		}
		return true;
	} catch {
		return true;
	}
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
	try {
		const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, "MAINTENANCE_MODE")).limit(1);
		const v = rows[0]?.value;
		if (typeof v === "object" && v && "enabled" in v) {
			return Boolean((v as { enabled?: boolean }).enabled);
		}
		if (v === true) return true;
		if (typeof v === "string") return v === "true";
		return false;
	} catch {
		return false;
	}
}
