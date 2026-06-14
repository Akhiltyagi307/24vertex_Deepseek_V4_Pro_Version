import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { featureFlags } from "@/db/schema/feature-flags";

/**
 * Step-up TOTP for destructive admin actions (hard-delete, refund). Defaults ON:
 * an absent flag — or a DB error reading it — requires TOTP, so the secure
 * posture is the default and a transient outage fails closed. Operators can
 * still opt out by explicitly setting the flag to `false` / `"false"` /
 * `{enabled:false}`. Enforcement is only meaningful when `ADMIN_TOTP_SECRET` is
 * configured (impersonation already hard-requires it, so it is in prod).
 */
export async function isAdminTotpRequired(): Promise<boolean> {
	try {
		const rows = await db.select().from(featureFlags).where(eq(featureFlags.key, "ADMIN_TOTP_REQUIRED")).limit(1);
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
