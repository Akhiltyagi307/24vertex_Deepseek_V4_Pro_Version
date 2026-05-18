import "server-only";

import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { auditLogs } from "@/db/schema/comms-audit";
import { clientIpForPostgresInet } from "@/lib/admin/ip-sanitize";
import { logServerError } from "@/lib/server/log-supabase-error";

import type { AuthActionName } from "./audit-actions";

export type AuthAuditInput = {
	action: AuthActionName;
	/** Null for failed-login attempts where no user id has been resolved yet. */
	userId: string | null;
	entityType?: string | null;
	entityId?: string | null;
	changes?: Record<string, unknown> | null;
	ipAddress?: string | null;
};

/**
 * Best-effort `audit_logs` row for auth events (login / signup / recovery).
 * Mirrors `writeOrganizationAccessAudit` — Drizzle insert under the request's
 * auth context, fire-and-forget for callers that `redirect()` immediately.
 * Never throws; on failure, logs to console and emits a Sentry warning so the
 * audit gap is visible without breaking the user's navigation.
 */
export async function writeAuthAudit(input: AuthAuditInput): Promise<boolean> {
	try {
		await db.insert(auditLogs).values({
			userId: input.userId,
			action: input.action,
			entityType: input.entityType ?? null,
			entityId: input.entityId ?? null,
			changes: input.changes ?? null,
			ipAddress: clientIpForPostgresInet(input.ipAddress),
		});
		return true;
	} catch (err) {
		logServerError("auth.audit.write", err, {
			action: input.action,
			userId: input.userId ?? "",
		});
		Sentry.captureMessage("auth_audit_failed", {
			level: "warning",
			tags: { feature: "auth", phase: "audit" },
			extra: { action: input.action, user_id: input.userId },
		});
		return false;
	}
}
